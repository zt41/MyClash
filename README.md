# MyClash

mihomo（Clash Meta）配置分流覆写脚本。上游项目 [AIsouler/MyClash](https://github.com/AIsouler/MyClash)，本仓库为个人定制版，托管在 `zt41/MyClash`，用于生成可持续更新的脚本订阅链接。

## 脚本链接

以下链接**永久有效**，始终指向 `main` 分支的最新版本。更新脚本只需推送到 GitHub，客户端无需更换链接。

| 用途 | 链接 | 说明 |
| --- | --- | --- |
| Raw（推荐） | `https://raw.githubusercontent.com/zt41/MyClash/main/Script/mihomoScript.js` | GitHub 官方源，实时生效 |
| jsDelivr | `https://cdn.jsdelivr.net/gh/zt41/MyClash@main/Script/mihomoScript.js` | CDN 缓存，约数分钟延迟 |
| jsdMirror | `https://cdn.jsdmirror.com/gh/zt41/MyClash@main/Script/mihomoScript.js` | 国内镜像，与脚本内规则集同源 |

## 使用方法

1. 打开客户端（Bettbox / Clash Meta for Android / mihomo 等）的**订阅**页面
2. 进入订阅的**覆写（Override）**设置 → 选择 **JavaScript** 类型
3. 填入上面的脚本链接，保存
4. 重新下载订阅即可生效

脚本已适配 Bettbox 的自定义配置参数（`Compatible_With_Bettbox`），在 Bettbox 中可直接在 UI 上勾选规则选项。

## 目录结构

```
MyClash/
├── Script/mihomoScript.js       # 主脚本，所有配置改动都在这里
├── Icons/svg/                   # 策略组图标（SVG），脚本通过 iconBaseUrl 引用
├── Icons/png/                   # 图标 PNG 版本
├── Test/smoke-test.js           # 冒烟测试，零第三方依赖
├── .github/workflows.disabled/  # CI 配置，见下方「启用自动检查」
└── .prettierrc.json             # Prettier 格式化配置
```

### 启用自动检查（可选）

`.github/workflows.disabled/check.yml` 会在推送后自动执行 `node --check` 与冒烟测试。GitHub 只把 `.github/workflows/` 目录下的文件当作工作流，所以要启用它，把目录改名为 `workflows` 即可：

- 在 GitHub 网页端把 `workflows.disabled` 重命名为 `workflows`（推荐，网页端不受 Token 权限限制）
- 或在本地执行 `git mv .github/workflows.disabled .github/workflows && git commit -m "ci: 启用自动检查" && git push`

注意：用命令行推送工作流文件，Token 需要额外的 `workflow` 权限。

## 如何更新

三种方式，任选其一：

- **网页编辑**：打开 `Script/mihomoScript.js`，点右上角铅笔图标直接改，改完 Commit
- **本地推送**：`git clone` → 改文件 → `git commit && git push`
- **同步上游**：上游修复或新增分流规则后，把 `Script/mihomoScript.js` 的差异手动合进来

推送到 `main` 后，GitHub Actions 会自动执行 `node --check` 与冒烟测试，失败会在 Actions 页面提示。

本地可先自检：

```bash
node Test/smoke-test.js
```

## 常见改动

| 想改什么 | 改哪里 |
| --- | --- |
| 开关某个分流策略组 | `ruleOptionsEnable` 中把对应项改为 `false` |
| 开关策略组类型（手动/自动/负载均衡） | `ruleOptionsEnable` 顶部 `手动选择` / `自动选择` / `负载均衡` |
| 增删地区节点组 | `regionDefinitions` |
| 增删倍率节点组 | `rateRegionDefinitions` |
| 自定义分流域名 | `functionalRuleSets` 里对应策略组的 `rules` 数组 |
| 添加自建节点 | `customizeProxies` |
| 自定义前置/兜底规则 | `prefixRules` / 脚本末尾 `newConfig['rules']` |
| 换图标 | 替换 `Icons/svg/` 下同名文件，或修改 `iconBaseUrl` |

图标地址 `iconBaseUrl` 默认指向本仓库 `Icons/svg/` 目录（自托管，不依赖上游仓库）。若想用上游图标，改成 `https://cdn.jsdmirror.com/gh/AIsouler/MyClash@main/Icons/svg/` 即可。

## 已知差异（相对上游）

本版本基于上游的一个早期版本定制，与上游 `main` 相比：

- 新增 `Nintendo`（任天堂）分流策略组与 `epicgames` 直连规则
- 无上游后续加入的 `家宽节点` 策略组、`GitHub` 分流组
- 已补齐 `DOMAIN,cdn.jsdmirror.com,直连` 前置规则，避免规则集拉取的鸡蛋问题

如需上游新特性，可从 [AIsouler/MyClash](https://github.com/AIsouler/MyClash) 手动合并。

## 许可证

[MIT](./LICENSE)，原作者 AIsouler。
