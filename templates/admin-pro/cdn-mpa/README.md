## <a id="zh"></a> 中文 | [English](#en)

# admin-pro / cdn-mpa

零构建 **MPA（多页应用）** 轻量后台模板：一个页面一个 HTML 文件、真实链接跳转、共享逻辑抽公共 JS——传统的原始做法。两个 CDN 标签（`@oas-ui/theme` css + `@oas-ui/ui` cdn.js）+ 原生 JS module，无需 node/npm 即可运行。

与同族 `admin-pro/cdn`（SPA：hash 路由 + JS 造页）形成对照：同 CDN 交付、不同架构。

功能：登录（任意非空用户名）· 真实跳转导航 · 仪表盘（统计卡 + oas-chart 渐变趋势）· 用户管理（oas-table 搜索/分页/弹窗 CRUD/popconfirm 删除）· 基础表单（oas-form 校验）· 中英切换（saved > navigator 嗅探：zh 系列 → zh-CN，其余一律 en；切换即整页 reload）。

组件内置文案联动：每页加载即按当前语言对齐组件内置 registry（`OASUI.setLocale`）——英文时动态加载与 cdn.js 同版本的纯数据语言包 `@oas-ui/i18n/dist/en.js`（成功缓存、失败下次启动重试），到达即广播刷新；语言包版本钉在 `js/i18n.js` 的 URL 字面量里，与各页 HTML 的 ui 版本由 `scripts/bump-cdn.mjs` 一并对齐。

## 使用

```bash
npx degit <本仓库地址>/templates/admin-pro/cdn-mpa my-admin
cd my-admin
# 任意静态服务器，例如：
npx serve .
```

> 运行时需联网拉取 unpkg 上的 oas-ui 资产。

## 结构

- `index.html`：登录页（已登录自动跳 dashboard.html）
- `dashboard.html` / `users.html` / `form.html`：三个业务页——**页面静态结构（壳 + 内容 markup）直接写在 HTML 里**，view-source 即完整文档；静态文本标 `data-i18n`，加载时按语言换文
- `js/fouc.js`：每页 `<head>` 同步引入，防语言闪烁（FOUC）
- `js/i18n.js`：中英字典与语言判定 + `applyStaticTexts()` 静态换文；`js/session.js`：会话与登录守卫；`js/shell.js`：壳层行为接线（侧栏 items / 语言切换 / 登出）；`js/data.js`：演示数据
- `js/login.js` / `js/dashboard.js` / `js/users.js` / `js/form.js` 页入口：guard + initShell + **行为接线与喂数据**（表格 rows/columns、chart.data、弹窗逻辑——组件 API 不是 markup，必须由 JS 提供）
- `css/app.css`：全部样式（只消费 theme 的 `--oas-*` token）

## 已知边界

- 组件内置文案跟随语言切换（当前源码未发布：页面加载即对齐 `OASUI.setLocale`；线上可用版本以包含 setLocale 的发布版为准。英文包加载完成前组件短暂保持中文，到达即刷新）
- 演示数据存 localStorage（`oas-admin-cdn-mpa.*` 独立命名空间），清 storage 即重置

## 在本仓库中

- `pnpm --filter admin-pro-cdn-mpa build`：纯拷贝产出 `dist/`（零编译）
- `pnpm --filter admin-pro-cdn-mpa test:e2e`：Playwright e2e（unpkg 请求拦截到本地 node_modules，离线稳定）
- 未发布集成批的发布、依赖/lockfile、URL pins、全量验证与 push/部署强制顺序见[仓根 README](../../../README.md#unreleased-cdn-batch)
- 仓根 `pnpm site` 自动聚合到 `site/dist/admin-pro/cdn-mpa/`

## <a id="en"></a> [中文](#zh) | English

# admin-pro / cdn-mpa

Zero-build **MPA (multi-page application)** lightweight admin template: one HTML file per page, real-link navigation, shared logic extracted into common JS — the classic, original approach. Two CDN tags (`@oas-ui/theme` css + `@oas-ui/ui` cdn.js) plus plain JS modules — no node/npm required to run.

A counterpart to `admin-pro/cdn` (SPA: hash router + JS-rendered pages): same CDN delivery, different architecture.

Features: login (any non-empty username) · real-link navigation · dashboard (stat cards + oas-chart gradient trend) · user management (oas-table search/pagination/modal CRUD/popconfirm delete) · basic form (oas-form validation) · zh-CN/en switch (saved > navigator sniffing: zh\* → zh-CN, everything else → en; switching reloads the page).

Component built-in texts follow the switch: each page load aligns the built-in component registry (`OASUI.setLocale`) with the current language — for English it dynamically loads the pure-data locale pack `@oas-ui/i18n/dist/en.js` pinned to the same version as cdn.js (success cached, failures retried on next load), refreshing components on arrival. The locale pack version is pinned in the `js/i18n.js` URL literal and kept in sync with the ui version in each page's HTML by `scripts/bump-cdn.mjs`.

## Usage

```bash
npx degit <this-repo>/templates/admin-pro/cdn-mpa my-admin
cd my-admin
npx serve .
```

> Requires internet access at runtime to pull oas-ui assets from unpkg.

## Structure

- `index.html`: login page (redirects to dashboard.html when already signed in)
- `dashboard.html` / `users.html` / `form.html`: the three business pages — **static page structure (shell + content markup) written directly in the HTML**, a complete document via view-source; static texts carry `data-i18n` and are swapped per locale on load
- `js/fouc.js`: synchronous per-page `<head>` script preventing language FOUC
- `js/i18n.js`: zh/en dictionary + locale detection + `applyStaticTexts()` static-text swapper; `js/session.js`: session + login guard; `js/shell.js`: shell behavior wiring (sidebar items / language toggle / logout); `js/data.js`: demo data
- `js/login.js` / `js/dashboard.js` / `js/users.js` / `js/form.js` page entries: guard + initShell + **behavior wiring and data feeding** (table rows/columns, chart.data, modal logic — component APIs, not markup, so they must come from JS)
- `css/app.css`: all styles (consumes only theme `--oas-*` tokens)

## Known boundaries

- Component built-in texts follow the language switch (current source unreleased: `OASUI.setLocale` aligned at page load; the runtime-capable version is whichever release ships with setLocale. Components stay Chinese briefly until the English pack arrives, then refresh)
- Demo data persists to localStorage (`oas-admin-cdn-mpa.*` namespace, isolated); clear storage to reset

## In this repo

- `pnpm --filter admin-pro-cdn-mpa build`: plain copy to `dist/` (zero compilation)
- `pnpm --filter admin-pro-cdn-mpa test:e2e`: Playwright e2e (unpkg requests intercepted to local node_modules — offline-stable)
- For the mandatory release, dependency/lockfile, URL pin, full-verification, and push/deployment order for an unreleased integration batch, see the [root README](../../../README.md#unreleased-cdn-batch-en)
- Aggregated by root `pnpm site` into `site/dist/admin-pro/cdn-mpa/`
