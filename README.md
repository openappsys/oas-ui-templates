## <a id="zh"></a> 中文 | [English](#en)

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

### 发布到 Cloudflare Workers（静态站）

仓库已带 `wrangler.jsonc`（Cloudflare Worker 静态资产站配置）。Connect GitHub 仓库后在 Cloudflare 建 **Worker**（项目用 wrangler 自动部署）：

| 项 | 值 |
| --- | --- |
| 路径（root directory） | `/`（仓库根，wrangler.jsonc 所在目录） |
| 构建/部署 | Wrangler 读 `wrangler.jsonc`（`assets.directory` → `site/dist`）自动构建 + 上传 |
| Node version | 20+ |
| 路由 | hash 路由，无需 SPA fallback |

`wrangler.jsonc` 要点：`assets.directory: ./site/dist`（单站：门户 + 各模版子路径）、`not_found_handling: single-page-application`、`build.command: corepack enable && pnpm install && pnpm site`（Cloudflare 构建时自动执行）。

> 模板 vite `base:'./'`（相对路径 asset）确保各模版挂子路径可用。

## CI

- 由 `.github/workflows/ci.yml` 的 matrix 驱动：模版列表（`matrix.template`）加一行即接入新模版
- push / PR：每模版 install + build + test + e2e
- 每周一 03:00 UTC 定时 + oas-ui 发版 repository_dispatch 触发依赖升级复测（防模版随主库演进腐烂）；仅覆盖 semver 范围内（^2.x）的 minor/patch 升级，主版本升级需人工评估

## License

[MIT OR Apache-2.0](./LICENSE) · Copyright (c) 2026 OpenAppSys

## <a id="en"></a> [中文](#zh) | English

# oas-ui-templates

A collection of project templates built on [oas-ui](https://oas-ui.dev), a framework-agnostic Web Components library. Each template is self-contained — install and run it on its own, or pull it via `npx degit`.

## Templates

| Template | Stack | Description | Unit | e2e | Status |
| --- | --- | --- | --- | --- | --- |
| `templates/admin-pro/vanilla-html` | Vite + TypeScript | Admin dashboard (zero-framework · i18n / request layer / 403/404) | ✅ | ✅ | Stable |

## Development

A pnpm workspace. From the repo root, after `pnpm install`:

```bash
pnpm build / pnpm test / pnpm check
```

e2e (requires a local Chromium):

```bash
pnpm --filter admin-pro-vanilla test:e2e
```

## Website / Publishing

The repo can be built as a **single site**: a portal landing page plus each template mounted under a sub-path (hash routing, no server-side fallback required).

```bash
pnpm site   # Aggregate build: build every template, then copy to site/dist/<family>/<template>/
```

Output layout (`site/dist`):

```
index.html                        # Portal landing page (from site/index.html)
admin-pro/vanilla-html/           # Template demo (template's own dist/)
```

- Templates use `base: './'` (relative asset paths) and can be mounted under any sub-path without affecting local dev / unit tests / e2e
- Add a new template: drop it under `templates/<family>/<name>` with a `package.json` and `pnpm site` will pick it up automatically

### Publish to Cloudflare Workers (static site)

`wrangler.jsonc` is included (Cloudflare Worker static-assets config). Connect the GitHub repo, then create a **Worker** on Cloudflare (the project deploys automatically via wrangler):

| Field | Value |
| --- | --- |
| Root directory | `/` (the repo root, where `wrangler.jsonc` lives) |
| Build / Deploy | Wrangler reads `wrangler.jsonc` (`assets.directory` → `site/dist`) — builds and uploads automatically |
| Node version | 20+ |
| Routing | Hash routing, no SPA fallback required |

`wrangler.jsonc` highlights: `assets.directory: ./site/dist` (single site: portal + per-template sub-paths), `not_found_handling: single-page-application`, `build.command: corepack enable && pnpm install && pnpm site` (Cloudflare runs it automatically at build time).

> The template's `vite.config.ts` uses `base: './'` (relative asset paths) so each template can be mounted under any sub-path.

## CI

- Driven by `.github/workflows/ci.yml` matrix: append a row to `matrix.template` to onboard a new template
- push / PR: install + build + test + e2e for every template
- Weekly Monday 03:00 UTC schedule + oas-ui release `repository_dispatch` to retry a dependency upgrade (preventing rot as the upstream library evolves); covers semver-range (`^2.x`) minor/patch upgrades only — major upgrades require manual review

## License

[MIT OR Apache-2.0](./LICENSE) · Copyright (c) 2026 OpenAppSys
