/**
 * GitHub Actions 用：下载一个或多个机场订阅 → 合并节点 → 运行 mihomoScript.js 覆写 → 输出最终 YAML
 * 依赖：js-yaml（工作流中通过 npm install 安装）
 *
 * 多个订阅 URL 在 SUB_URL 中用换行或逗号分隔，例如：
 *   https://airport1.com/sub?token=xxx
 *   https://airport2.com/sub?token=yyy
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SUB_URL = process.env.SUB_URL;
if (!SUB_URL) {
  console.error('错误：未设置 SUB_URL 环境变量');
  process.exit(1);
}

// 解析多个 URL：按换行或逗号分隔，去掉空行和注释
const subUrls = SUB_URL
  .split(/[\n,]+/)
  .map(u => u.trim())
  .filter(u => u && !u.startsWith('#'));

if (subUrls.length === 0) {
  console.error('错误：SUB_URL 中未找到有效的订阅链接');
  process.exit(1);
}

console.log(`共 ${subUrls.length} 个订阅链接`);

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: { 'User-Agent': 'clash-meta/1.0' },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject).on('timeout', function() { this.destroy(new Error('请求超时')); });
  });
}

function tryParseYaml(text) {
  try {
    const r = yaml.load(text);
    if (r && typeof r === 'object' && Array.isArray(r.proxies) && r.proxies.length > 0) return r;
  } catch {}
  return null;
}

function parseSubscription(text) {
  let config = tryParseYaml(text);
  if (config) return config;
  try {
    const decoded = Buffer.from(text.trim(), 'base64').toString('utf8');
    config = tryParseYaml(decoded);
    if (config) return config;
  } catch {}
  return null;
}

// 节点去重：按 name + server + port 判断
function dedupeProxies(proxies) {
  const seen = new Set();
  return proxies.filter(p => {
    const key = `${p.name}|${p.server}|${p.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function run() {
  console.log('1. 下载订阅...');
  const results = await Promise.allSettled(subUrls.map(u => fetch(u)));

  const allProxies = [];
  let baseConfig = null;
  let successCount = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const url = subUrls[i];
    // 隐藏 token 部分用于日志
    const displayUrl = url.replace(/([?&](token|key|password|secret)=)[^&]+/gi, '$1***');
    if (r.status === 'rejected') {
      console.warn(`   [警告] 订阅 ${i + 1} 下载失败：${r.reason.message}  (${displayUrl})`);
      continue;
    }
    const config = parseSubscription(r.value);
    if (!config) {
      console.warn(`   [警告] 订阅 ${i + 1} 解析失败，跳过  (${displayUrl})`);
      continue;
    }
    console.log(`   订阅 ${i + 1}：${config.proxies.length} 个节点  (${displayUrl})`);
    allProxies.push(...config.proxies);
    // 用第一个成功的订阅作为基础配置（dns、hosts 等字段）
    if (!baseConfig) baseConfig = config;
    successCount++;
  }

  if (successCount === 0) {
    console.error('所有订阅都下载/解析失败');
    process.exit(1);
  }

  console.log(`2. 合并节点：共 ${allProxies.length} 个（来自 ${successCount} 个订阅）`);
  const merged = dedupeProxies(allProxies);
  console.log(`   去重后：${merged.length} 个节点`);

  // 构造合并后的 config
  const config = { ...baseConfig, proxies: merged };

  console.log('3. 加载覆写脚本...');
  const scriptPath = path.join(__dirname, 'mihomoScript.js');
  const scriptSrc = fs.readFileSync(scriptPath, 'utf8');
  const mainFn = new Function(`${scriptSrc}; return typeof main === 'function' ? main : null;`)();
  if (!mainFn) {
    console.error('覆写脚本中未找到 main() 函数');
    process.exit(1);
  }

  console.log('4. 运行覆写脚本...');
  const result = mainFn(config);
  const groups = result['proxy-groups'] || [];
  const rules = result.rules || [];
  const providers = result['rule-providers'] || {};
  console.log(`   ${groups.length} 个策略组，${rules.length} 条规则，${Object.keys(providers).length} 个规则集`);

  // Stash 兼容处理：替换不支持的字段
  console.log('5. Stash 兼容处理...');
  let compatCount = 0;
  for (const g of groups) {
    // sticky-sessions → round-robin（Stash 不支持 sticky-sessions）
    if (g.strategy === 'sticky-sessions') {
      g.strategy = 'round-robin';
      compatCount++;
    }
    // Stash 不支持的扩展字段，直接删除
    for (const key of ['hidden', 'exclude-type', 'include-all', 'include-all-proxies', 'include-all-providers', 'empty-fallback', 'max-failed-times']) {
      if (key in g) { delete g[key]; compatCount++; }
    }
  }
  // 处理 proxies 中 Stash 可能不支持的字段
  if (Array.isArray(result.proxies)) {
    for (const p of result.proxies) {
      for (const key of ['udp', 'skip-cert-verify', 'sni', 'alpn', 'fingerprint', 'client-fingerprint', 'reality-opts', 'flow', 'ws-opts', 'h2-opts', 'grpc-opts']) {
        // 保留这些字段，Stash 大多支持，先不删
      }
    }
  }
  if (compatCount > 0) console.log(`   处理了 ${compatCount} 处不兼容字段`);
  else console.log('   无需处理');

  console.log('6. 输出最终 YAML...');
  const output = yaml.dump(result, { lineWidth: -1, noRefs: true, sortKeys: false });

  const outDir = path.join(__dirname, '..', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'clash.yaml');
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`   已写入 output/clash.yaml，${(output.length / 1024).toFixed(1)} KB`);
  console.log('完成');
}

run().catch(err => {
  console.error('失败：', err.message);
  process.exit(1);
});
