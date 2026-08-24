# oas-ui-templates

基于 [oas-ui](https://oas-ui.dev)（框架无关 Web Components 组件库）的项目模版集合。每个模版目录自包含，可独立安装运行，或 `npx degit` 取用。

## 模版

| 模版 | 技术栈 | 说明 | 单测 | e2e | 状态 |
| --- | --- | --- | --- | --- | --- |
| `templates/admin-pro/vanilla-html` | Vite + TypeScript | 后台管理系统（零框架） | ✅ | ✅ | 可用 |

## 开发

pnpm workspace；根目录执行 `pnpm install` 后：

```bash
pnpm build / pnpm test / pnpm check
```

e2e（需本地 Chromium）：

```bash
pnpm --filter admin-pro-vanilla test:e2e
```

## CI

- push / PR：每模版 install + build + test + e2e
- 每周一 03:00 UTC 定时 + oas-ui 发版 repository_dispatch 触发依赖升级复测（防模版随主库演进腐烂）；仅覆盖 semver 范围内（^2.x）的 minor/patch 升级，主版本升级需人工评估
