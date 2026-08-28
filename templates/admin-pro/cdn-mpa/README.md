## <a id="zh"></a> 中文 | [English](#en)

# admin-pro / cdn-mpa

零构建 **MPA（多页应用）** 轻量后台模板：一个页面一个 HTML 文件、真实链接跳转、共享逻辑抽公共 JS——传统的原始做法。两个 CDN 标签（`@oas-ui/theme` css + `@oas-ui/ui` cdn.js）+ 原生 JS module，无需 node/npm 即可运行。

与同族 `admin-pro/cdn`（SPA：hash 路由 + JS 造页）形成对照：同 CDN 交付、不同架构。

功能：登录（任意非空用户名）· 真实跳转导航 · 仪表盘（统计卡 + oas-chart 渐变趋势）· 用户管理（oas-table 搜索/分页/弹窗 CRUD/popconfirm 删除）· 基础表单（oas-form 校验）· 中英切换（saved > navigator 嗅探：zh 系列 → zh-CN，其余一律 en；切换即整页 reload）。

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
- `dashboard.html` / `users.html` / `form.html`：三个业务页（真实 HTML 文件，view-source 可读）
- `js/fouc.js`：每页 `<head>` 同步引入，防语言闪烁（FOUC）
- `js/i18n.js`：中英字典与语言判定；`js/session.js`：会话与登录守卫；`js/shell.js`：壳层（顶栏+侧栏）一处渲染；`js/data.js`：演示数据；`js/*.js` 页入口：guard + mountShell + 本页渲染
- `css/app.css`：全部样式（只消费 theme 的 `--oas-*` token）

## 已知边界

- **组件内置文案（popconfirm 确定/取消、table 空态等）恒为 zh-CN**：cdn.js IIFE 内联了 i18n registry，外部无法接管；应用层文案（壳层/页面）中英切换不受影响
- 演示数据存 localStorage（`oas-admin-cdn-mpa.*` 独立命名空间），清 storage 即重置

## 在本仓库中

- `pnpm --filter admin-pro-cdn-mpa build`：纯拷贝产出 `dist/`（零编译）
- `pnpm --filter admin-pro-cdn-mpa test:e2e`：Playwright e2e（unpkg 请求拦截到本地 node_modules，离线稳定）
- 仓根 `pnpm site` 自动聚合到 `site/dist/admin-pro/cdn-mpa/`

## <a id="en"></a> [中文](#zh) | English

# admin-pro / cdn-mpa

Zero-build **MPA (multi-page application)** lightweight admin template: one HTML file per page, real-link navigation, shared logic extracted into common JS — the classic, original approach. Two CDN tags (`@oas-ui/theme` css + `@oas-ui/ui` cdn.js) plus plain JS modules — no node/npm required to run.

A counterpart to `admin-pro/cdn` (SPA: hash router + JS-rendered pages): same CDN delivery, different architecture.

Features: login (any non-empty username) · real-link navigation · dashboard (stat cards + oas-chart gradient trend) · user management (oas-table search/pagination/modal CRUD/popconfirm delete) · basic form (oas-form validation) · zh-CN/en switch (saved > navigator sniffing: zh\* → zh-CN, everything else → en; switching reloads the page).

## Usage

```bash
npx degit <this-repo>/templates/admin-pro/cdn-mpa my-admin
cd my-admin
npx serve .
```

> Requires internet access at runtime to pull oas-ui assets from unpkg.

## Structure

- `index.html`: login page (redirects to dashboard.html when already signed in)
- `dashboard.html` / `users.html` / `form.html`: the three business pages (real HTML files, readable via view-source)
- `js/fouc.js`: synchronous per-page `<head>` script preventing language FOUC
- `js/i18n.js`: zh/en dictionary + locale detection; `js/session.js`: session + login guard; `js/shell.js`: shell (top bar + sidebar) rendered once; `js/data.js`: demo data; `js/*.js` page entries: guard + mountShell + page render
- `css/app.css`: all styles (consumes only theme `--oas-*` tokens)

## Known boundaries

- **Component built-in texts (popconfirm OK/Cancel, table empty state, etc.) stay zh-CN**: cdn.js inlines the i18n registry inside its IIFE bundle and cannot be taken over externally; app-level copy (shell/pages) switches freely
- Demo data persists to localStorage (`oas-admin-cdn-mpa.*` namespace, isolated); clear storage to reset

## In this repo

- `pnpm --filter admin-pro-cdn-mpa build`: plain copy to `dist/` (zero compilation)
- `pnpm --filter admin-pro-cdn-mpa test:e2e`: Playwright e2e (unpkg requests intercepted to local node_modules — offline-stable)
- Aggregated by root `pnpm site` into `site/dist/admin-pro/cdn-mpa/`
