# oas-ui-templates

基于 [oas-ui](https://oas-ui.dev)（框架无关 Web Components 组件库）的项目模版集合。每个模版目录自包含，可独立安装运行，或 `npx degit` 取用。

## 模版

| 模版 | 技术栈 | 说明 | 单测 | e2e | 状态 |
| --- | --- | --- | --- | --- | --- |
| `templates/admin-pro/vanilla-html` | Vite + TypeScript | 后台管理系统（零框架 · i18n / 请求层 / 403/404） | ✅ | ✅ | 可用 |

## 开发

pnpm workspace；根目录执行 `pnpm install` 后：

```bash
pnpm build / pnpm test / pnpm check
```

e2e（需本地 Chromium）：

```bash
pnpm --filter admin-pro-vanilla test:e2e
```

## 网站 / 发布

仓库可一键构建为**单站**：门户首页 + 各模版作为子路径（hash 路由，无需服务端 fallback）。

```bash
pnpm site   # 聚合构建：逐模版 build + 拷贝到 site/dist/<family>/<template>/
```

产物结构（`site/dist`）：

```
index.html                        # 门户首页（site/index.html）
admin-pro/vanilla-html/           # 模版 demo（模版自己的 dist）
```

- 模版 vite 用 `base: './'`（相对路径 asset），可挂任意子路径，不影响本地 dev / 单测 / e2e
- 新增模版：在 `templates/<family>/<name>` 放模版（带 package.json），`pnpm site` 自动发现并打包

### 发布到 Cloudflare Pages

| 项 | 值 |
| --- | --- |
| Framework preset | 无 / Node |
| Root directory | `/`（仓库根） |
| Build command | `corepack enable && pnpm install && pnpm site` |
| Build output directory | `site/dist` |
| Node version | 20+ |
| 路由 | hash 路由，无需 SPA fallback |

> `corepack enable` 让 Cloudflare 构建使用仓库声明的 pnpm（`packageManager: pnpm@11.20.0`）。

## CI

- 由 `.github/workflows/ci.yml` 的 matrix 驱动：模版列表（`matrix.template`）加一行即接入新模版
- push / PR：每模版 install + build + test + e2e
- 每周一 03:00 UTC 定时 + oas-ui 发版 repository_dispatch 触发依赖升级复测（防模版随主库演进腐烂）；仅覆盖 semver 范围内（^2.x）的 minor/patch 升级，主版本升级需人工评估

## License

[MIT OR Apache-2.0](./LICENSE) · Copyright (c) 2026 OpenAppSys
