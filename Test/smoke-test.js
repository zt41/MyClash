/**
 * mihomo 覆写脚本冒烟测试
 *
 * 用法：node Test/smoke-test.js
 *
 * 该测试不依赖任何第三方库，仅做基本的结构校验，
 * 用于防止脚本改动后出现语法错误或输出结构缺失。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scriptPath = path.join(__dirname, '..', 'Script', 'mihomoScript.js');
const source = fs.readFileSync(scriptPath, 'utf8');

// 模拟机场订阅配置
const sampleConfig = {
  proxies: [
    { name: '香港 01', type: 'ss', server: '1.2.3.4', port: 443, cipher: 'aes-128-gcm', password: 'p' },
    { name: '🇯🇵 日本 02', type: 'ss', server: 'jp.example.com', port: 443, cipher: 'aes-128-gcm', password: 'p' },
    { name: '美国 03 x2', type: 'trojan', server: 'us.example.com', port: 443, password: 'p' },
    { name: '新加坡 04', type: 'vmess', server: 'sg.example.com', port: 443, uuid: 'u', alterId: 0, cipher: 'auto' },
    { name: '官网 订阅地址 https://example.com', type: 'ss', server: '5.6.7.8', port: 443, cipher: 'aes-128-gcm', password: 'p' },
    { name: 'DIRECT', type: 'direct' },
    { name: 'REJECT', type: 'reject' },
  ],
  dns: {
    enable: true,
    nameserver: ['223.5.5.5'],
    'proxy-server-nameserver': ['https://1.12.12.12/dns-query'],
    listen: '0.0.0.0:1053',
  },
  hosts: {},
};

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

if (typeof sandbox.main !== 'function') {
  console.error('✗ 脚本未导出 main(config) 函数');
  process.exit(1);
}

const result = sandbox.main(sampleConfig);

const assertions = [
  ['proxies 非空', Array.isArray(result.proxies) && result.proxies.length > 0],
  ['proxy-groups 非空', Array.isArray(result['proxy-groups']) && result['proxy-groups'].length > 0],
  ['rule-providers 非空', result['rule-providers'] && Object.keys(result['rule-providers']).length > 0],
  ['rules 非空', Array.isArray(result.rules) && result.rules.length > 0],
  ['rules 以 MATCH 结尾', String(result.rules[result.rules.length - 1]).startsWith('MATCH,')],
  ['dns 配置存在', !!result.dns && result.dns['enhanced-mode'] === 'fake-ip'],
  ['GLOBAL 组存在', result['proxy-groups'].some((g) => g.name === 'GLOBAL')],
  ['默认代理组存在', result['proxy-groups'].some((g) => g.name === '默认代理')],
  ['内置节点已被剔除', !result.proxies.some((p) => String(p.type).toLowerCase() === 'reject')],
  ['信息节点已被过滤', !result.proxies.some((p) => p.name.includes('官网'))],
];

let failed = 0;
for (const [name, ok] of assertions) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} 项断言失败`);
  process.exit(1);
}

console.log(`\n冒烟测试通过：${result.proxies.length} 个节点，${result['proxy-groups'].length} 个策略组，${result.rules.length} 条规则`);
