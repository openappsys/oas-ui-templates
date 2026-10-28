## <a id="zh"></a> 中文 | [English](#en)

# admin-pro / cdn

零构建轻量后台模板：两个 CDN 标签（`@oas-ui/theme` css + `@oas-ui/ui` cdn.js）+ 原生 JS module，无需 node/npm 即可运行。

功能：登录（任意非空用户名）· hash 路由 · 仪表盘（统计卡 + oas-chart 渐变趋势）· 用户管理（oas-table 搜索/分页/弹窗 CRUD/popconfirm 删除）· 基础表单（oas-form 校验）· 中英切换（saved > navigator 嗅探：zh 系列 → zh-CN，其余一律 en；FOUC 防闪）。

组件内置文案联动：切英文时壳层即时切换，组件内置文案（popconfirm 确定/取消、空态等）经 `OASUI.setLocale` 动态加载与 cdn.js 同版本的纯数据语言包 `@oas-ui/i18n/dist/en.js` 后跟切（成功缓存、失败可重试、慢包迟到不覆盖当前语言）；切回中文同步回落。语言包版本钉在 `i18n.js` 的 URL 字面量里，与 index.html 的 ui 版本由 `scripts/bump-cdn.mjs` 一并对齐。

## 使用

```bash
npx degit <本仓库地址>/templates/admin-pro/cdn my-admin
cd my-admin
# 任意静态服务器，例如：
npx serve .
```

> 运行时需联网拉取 unpkg 上的 oas-ui 资产。

## 已知边界

- 组件内置文案跟随语言切换（v2.6.4 起：`OASUI.setLocale` + 同版本纯数据语言包动态加载；英文包加载完成前组件短暂保持中文，到达即刷新）
- 演示数据存 localStorage，清 storage 即重置

## 在本仓库中

- `pnpm --filter admin-pro-cdn build`：纯拷贝产出 `dist/`（零编译）
- `pnpm --filter admin-pro-cdn test:e2e`：Playwright e2e（unpkg 请求拦截到本地 node_modules，离线稳定）
- 仓根 `pnpm site` 自动聚合到 `site/dist/admin-pro/cdn/`

## <a id="en"></a> [中文](#zh) | English

# admin-pro / cdn

Zero-build lightweight admin template: two CDN tags (`@oas-ui/theme` css + `@oas-ui/ui` cdn.js) plus plain JS modules — no node/npm required to run.

Features: login (any non-empty username) · hash router · dashboard (stat cards + oas-chart gradient trend) · user management (oas-table search/pagination/modal CRUD/popconfirm delete) · basic form (oas-form validation) · zh-CN/en switch (saved > navigator sniffing: zh\* → zh-CN, everything else → en; FOUC-free).

Component built-in texts follow the switch: switching to English updates the shell instantly, while built-in component copy (popconfirm OK/Cancel, empty states, etc.) is switched via `OASUI.setLocale` after dynamically loading the pure-data locale `@oas-ui/i18n/dist/en.js` pinned to the same version as cdn.js (success cached, failures retried on the next switch, late responses never override the current language); switching back to Chinese falls back synchronously. The locale pack version is pinned in the `i18n.js` URL literal and kept in sync with the ui version in index.html by `scripts/bump-cdn.mjs`.

## Usage

```bash
npx degit <this-repo>/templates/admin-pro/cdn my-admin
cd my-admin
npx serve .
```

> Requires internet access at runtime to pull oas-ui assets from unpkg.

## Known boundaries

- Component built-in texts follow the language switch (since v2.6.4: `OASUI.setLocale` + same-version pure-data locale pack loaded dynamically; components stay Chinese briefly until the pack arrives, then refresh)
- Demo data persists to localStorage; clear storage to reset

## In this repo

- `pnpm --filter admin-pro-cdn build`: plain copy to `dist/` (zero compilation)
- `pnpm --filter admin-pro-cdn test:e2e`: Playwright e2e (unpkg requests intercepted to local node_modules — offline-stable)
- Aggregated by root `pnpm site` into `site/dist/admin-pro/cdn/`
