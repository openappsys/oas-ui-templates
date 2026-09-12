# admin-pro/svelte 模版 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 新建 `templates/admin-pro/svelte` 模版（Vite 8 + Svelte 5 + TS 纯 CSR），功能与 vanilla-html 全量对齐（23 条路由 + 全机制），与 react/vue 并列第三框架模版。

**Architecture:** 纯 TS 层从 react 模版复制（已多轮验收）；Svelte 特有层新写。Spike 已实证（2026-09-12）：原生事件 onclick 直绑 ✓、kebab 自定义事件 `onoas-submit={...}` ✓、message API ✓、property 通道（bind:this + $effect，render 收整行）✓、布尔存在性用 `attr={cond ? '' : null}`（null 整属性省略，比 Vue 更顺）。

**Tech Stack:** Vite 8 + Svelte 5 + TypeScript 7 + svelte-check + vitest 5（happy-dom）+ playwright

## Global Constraints

- 新增文件全部在 `templates/admin-pro/svelte/` 下；不动其他模版目录
- `@oas-ui/*` 版本 `^2.5.0`；vitest `^5.0.0`；svelte `^5`；vite `base: './'`
- dev 端口 **5186**、e2e 端口 **5187**
- 不引第三方状态库（Svelte stores 是官方一等公民，用 writable/readable/derived）
- 不引路由库：svelte-spa-router 是 hash-only 满足不了双模式，**自研轻量 hash/history 路由**（移植 vanilla `router/mode.ts` 双模式逻辑 + Svelte store 封装；参考 react/vue 的 guard 三态与页签语义）
- oas-* 组件使用纪律（spike 实测结论）：
  1. 原生事件（click 等）模板直绑 `onclick`
  2. oas-* 自定义事件模板直绑 `onoas-submit={handler}`（Svelte 5 原生支持，无需桥接层）
  3. 复杂数据（含 render 函数的 columns 等）走 property 通道：`bind:this` + `$effect` 赋值（render 函数签名是 `render(row)` 收整行，不是收单元格值）
  4. 纯数据（无函数）走 JSON 字符串 attribute
  5. 布尔 attribute 存在性语义：`{cond ? '' : null}`（null 整属性省略）
  6. 命令式 API 统一 `src/lib/app-message.ts`
- 功能/DOM/类名/data-testid 与 react/vue 版一致；实现用 Svelte 生态惯用写法（SFC scoped style、$state/$derived/$effect runes、stores）
- 代码注释中文；commit message 中文 conventional commits（`feat(admin-svelte): ...`）
- 每任务完成门槛：`pnpm --filter admin-pro-svelte test` 全绿 + `build`（svelte-check + vite）通过
- 单文件 ≤400 行

---

### Task 1: 工程脚手架 + 纯 TS 层复制 + Svelte 集成封装层 + 路由层

**Files:**
- Create: `templates/admin-pro/svelte/` 全套工程配置（package.json / vite.config.ts（@sveltejs/vite-plugin-svelte）/ tsconfig.json / svelte.config.js / index.html（FOUC 脚本逐字保留）/ playwright.config.ts（端口 5187）/ scripts/size.mjs（从 vanilla 复制）/ src/main.ts / src/App.svelte 占位）
- Create（从 **react 模版**复制，零漂移）: `src/api/`、`src/data/`、`src/store/`、`src/i18n/`、`src/settings-init.ts`、`src/layout-config.ts`、`src/error.ts`、`src/analytics.ts`、`src/env.d.ts`、**`src/router/tabs.ts` + tabs.test.ts**（纯函数状态机直接可用）、**`src/router/guard.ts` + guard.test.ts**
- Create（Svelte 特有）: `src/lib/app-message.ts`、`src/lib/use-t.svelte.ts`（readable store 包 i18n：`useT()` 返回 `{ t, locale }` store）、`src/app.d.ts`（`svelteHTML.IntrinsicElements` 声明 oas-* 标签）
- Create（自研路由）: `src/router/mode.ts`（从 react 版复制适配）、`src/router/routes.ts`（AppRoute 表 23 条，与 react/vue 逐字对齐）、`src/router/index.ts`（hash/history store 路由：currentPath store + navigate + beforeEach 等价守卫 + 布局壳接线）、**全部 23 个页面占位 .svelte**（含 login）

**Interfaces:**
- Produces: 工程可 dev/build/test；路由 store（`currentPath`、`navigate(path)`、守卫重定向语义同 react/vue）；`useT()`；占位 App.svelte 渲染 `<RouterView/>`

- [ ] 工程文件按上方清单创建（package.json 参照 react 版，dependencies 换 `svelte: ^5.0.0`，devDeps 加 `@sveltejs/vite-plugin-svelte`、`svelte-check`，去掉 react 系）
- [ ] 纯 TS 层复制后 `diff -r` 逐目录零漂移核对
- [ ] 自研路由：hash 默认、history 可选（读 `oas-admin.router-mode`），守卫三态（login/forbidden/not-found）与 react/vue 语义一致
- [ ] 验证：`pnpm install`（workspace 根）、`pnpm --filter admin-pro-svelte test`（复制的 110 例 + tabs/guard 全绿）、`build` 通过、dev 可访问
- [ ] Commit: `feat(admin-svelte): 工程脚手架 + 纯 TS 层复制 + 自研双模式路由`

### Task 2: AppShell 布局壳 + 设置中心页

**Files:**
- Create: `src/components/` 下 app-shell.svelte、header-bar.svelte、nav-menu.svelte、tabs-bar.svelte、notifications-drawer.svelte、command-palette.svelte + 各自 scoped 样式
- Create: `src/pages/settings.svelte` + `src/pages/settings/` 四 Tab 子组件（真实实现，替换占位）
- Modify: `src/main.ts`（接线：初始化 → 挂载）、`src/router/index.ts`（接真实 AppShell）

**Interfaces / 行为规范:** 与 react/vue 版 AppShell 逐块等价（事实来源：vanilla `app-shell.ts`）：形态×位置矩阵 8 组合、三形态高亮机制、`oas:navconfig-change` 实时切换、页签语义（关闭/右键/首页不可关）、主题/语言/通知/登出/命令面板（Ctrl+K / `/`）、**oas-tabs 的 label 变化不重读——切语言时页签栏与页内 tabs 按 locale 重挂载**（react/vue 已沉淀此修法）。设置中心四 Tab 持久化键与即时生效逐项对齐；路由模式控件 modal.confirm 二次确认 + 整页刷新。

- [ ] 壳层六组件 + settings 四 Tab
- [ ] `pnpm --filter admin-pro-svelte test` 全绿 + `build` 通过 + dev 走查（三形态×位置、页签、主题/语言切换、通知、登出闭环）
- [ ] Commit: `feat(admin-svelte): AppShell 布局壳 + 设置中心页`

### Task 3: 页面批 1——login + dashboard

- [ ] login.svelte（双版式 split/glass，onoas-submit 直绑，session.login 后 navigate 首页）+ dashboard.svelte（统计卡 skeleton、oas-chart 7/14/30 联动、最近订单表格）
- [ ] 验证三件套 + dev 走查全流程
- [ ] Commit: `feat(admin-svelte): login + dashboard 页`

### Task 4: 页面批 2——products + product-edit + users + profile + forbidden + not-found + server-error

- [ ] products（双视图/三表单模式/批量/列设置/分页——**oas-pagination 的 update() 会自摘 hidden，用 $effect 命令式补写**，react/vue 已沉淀同款修法）+ product-edit + users（拆子组件）+ profile + 三个错误页
- [ ] 验证三件套 + dev 走查全链路
- [ ] Commit: `feat(admin-svelte): products/users/profile/错误页`

### Task 5: 页面批 3——orders + order-detail + result + category + logs

- [ ] 5 页移植；order-detail 隐藏路由归父页签场景；category 复用 dict.css（styles/pages 下 Svelte 对应物）
- [ ] 验证三件套 + dev 走查
- [ ] Commit: `feat(admin-svelte): orders/order-detail/result/category/logs 页`

### Task 6: 页面批 4——dept + dict + menus + roles + basic-form + form + advanced-form + data-board

- [ ] 8 页移植（menus/dept 树形注意拆子组件；**tree 的 expanded 契约是 JSON 字符串数组**——2.5.0 已收紧，join(',') 会静默全折叠，react/vue 已沉淀修法）
- [ ] 验证三件套 + dev 走查
- [ ] Commit: `feat(admin-svelte): dept/dict/menus/roles/basic-form/form/advanced-form/data-board 页`

### Task 7: e2e 移植 + 终验

- [ ] e2e 四 spec 起步（smoke/tabs/settings/products）对齐 react 版断言，再扩展到 system/logs/form 等新增页面（react 版 e2e 为对齐基准）
- [ ] 全量 e2e 两遍全绿；`pnpm site` 通过；`size` 通过
- [ ] Commit: `test(admin-svelte): e2e 全量覆盖`

## 收尾（控制器执行）

- 门户首页加第六张卡片（admin-pro / svelte）+ README 表格加行
- 与 react/vue 的对照检查：路由表/页面 DOM/testid 一致性抽查
