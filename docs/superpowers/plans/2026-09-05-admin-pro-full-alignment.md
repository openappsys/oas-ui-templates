# admin-pro react/vue 全量对齐 vanilla 实现计划（页面补齐收尾）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 把 react/vue 两端从 11 页子集补齐到与 vanilla-html 26 页功能表完全等价（一次性对齐终态；此后两端按用户决策各自演化）。

**Architecture:** 页面模式已被 products/users 打样固化；剩余 11 页的数据层（orders/logs/system/categories 等）在 Task 2 已全量移植并带测试。本计划纯粹是页面组件移植 + 路由表补齐 + e2e 扩展。

**Tech Stack:** 同既有两模版。

## Global Constraints

- 只动 `templates/admin-pro/react/` 与 `templates/admin-pro/vue/` 各自目录；不动 vanilla/cdn/site
- 路由表 meta（path/titleKey/icon/iconColor/roles/hidden/group/parent）以 vanilla `routes.ts` 为唯一事实来源逐字对齐
- 页面行为/DOM/类名/data-testid 以 vanilla 同名页面为事实来源；react/vue 两端保持一致
- 各页面级 CSS 从 vanilla 原样复制（dept.css/dict.css/logs.css；category 复用 dict.css，与 vanilla 一致）
- i18n key 语言包已全量存在，无需新增；若发现缺 key 属移植错误，报告并修
- 单文件 ≤400 行（贴线时拆子组件）；每个新页面文件头写「事实来源 + 偏差因果链」
- commit message：`feat(admin-react): ...` / `feat(admin-vue): ...` 中文 conventional
- 每任务完成门槛：两端各自 `test` 全绿 + `build` 通过
- 数据层（data/orders、data/logs、data/system、data/categories）已全量移植就位，直接消费

---

### Task 1: react 批次 A——orders + order-detail + result + category + logs

**Files:**
- Create: `templates/admin-pro/react/src/pages/orders.tsx`、`order-detail.tsx`、`result.tsx`、`category.tsx`、`logs.tsx`（建议按需拆子组件）
- Create: `templates/admin-pro/react/src/styles/pages/logs.css`（从 vanilla 复制；category 复用 dict.css——同 vanilla 的复用关系，dict.css 由 Task 3 复制，本任务先建空的占位 import 或调整加载策略并在报告说明）
- Modify: `src/router/routes.tsx`（4 条新路由：/orders、/order-detail（hidden+parent=/orders）、/result、/category，meta 逐字对齐 vanilla routes.ts）

**Interfaces:**
- Consumes: data/orders、data/logs、data/categories、data/system、settings-init、useOasEvent/useT/appMessage（全部已就位）
- Produces: 5 个页面默认导出组件 + 4 条路由

- [ ] 移植 5 个页面（行为/DOM/类名/testid 对齐 vanilla 同名源文件）
- [ ] 路由表对齐 + 未知 key 自查（titleKey 必须在 app-zh.ts 存在）
- [ ] `pnpm --filter admin-pro-react test` 全绿 + `build` 通过 + dev 手动走查新页面
- [ ] Commit: `feat(admin-react): orders/order-detail/result/category/logs 页`

---

### Task 2: vue 批次 A——orders + order-detail + result + category + logs

**Files:**
- Create: `templates/admin-pro/vue/src/pages/orders.vue`、`order-detail.vue`、`result.vue`、`category.vue`、`logs.vue` + `styles/pages/logs.css`（从 vanilla 复制）
- Modify: `src/router/routes.ts`（同 Task 1 的 4 条路由，与 react 版逐字对齐）

**Interfaces:**
- 同 Task 1；对齐参照：vanilla 源文件（react 版同期并行开发，开工时若已存在可直接对照）

- [ ] 移植 5 个页面（vue 纪律：布尔存在性语义、@oas-* 直绑、复杂数据 JSON 字符串）
- [ ] 路由表对齐
- [ ] `pnpm --filter admin-pro-vue test` 全绿 + `build`（vue-tsc）通过 + dev 走查
- [ ] Commit: `feat(admin-vue): orders/order-detail/result/category/logs 页`

---

### Task 3: react 批次 B——dept + dict + menus + roles + basic-form + form

**Files:**
- Create: `templates/admin-pro/react/src/pages/dept.tsx`、`dict.tsx`、`menus.tsx`、`roles.tsx`、`basic-form.tsx`、`form.tsx` + `styles/pages/dept.css`、`dict.css`（从 vanilla 复制；category 页改为复用 dict.css 的真实文件）
- Modify: `src/router/routes.tsx`（6 条新路由，meta 逐字对齐 vanilla routes.ts）

**Interfaces:**
- Consumes: data/system（dept/dict/menu/role 四组 CRUD + treeDepts/treeMenus）
- Produces: 6 个页面组件 + 6 条路由

- [ ] 移植 6 个页面（menus 505 行/dept 445 行注意拆子组件）
- [ ] 路由表对齐 + category 页切换为真实 dict.css
- [ ] test 全绿 + build + dev 走查
- [ ] Commit: `feat(admin-react): dept/dict/menus/roles/basic-form/form 页`

---

### Task 4: vue 批次 B——dept + dict + menus + roles + basic-form + form

**Files / 验证 / Commit:**
- 同 Task 3 的 vue 版（`.vue` 页面 + routes.ts + 两份 CSS），Commit: `feat(admin-vue): dept/dict/menus/roles/basic-form/form 页`

---

### Task 5: react e2e 扩展 + 终验

**Files:**
- Modify/Create: `templates/admin-pro/react/e2e/` 移植 vanilla e2e 中覆盖新页面的用例（system.spec、system2.spec、logs.spec、form.spec、misc.spec 相关部分；pages.spec 的页面可达性按新页面补齐）

- [ ] 移植并跑绿（flaky 用 expect.poll/waitFor；禁止 waitForTimeout 堆叠；跑两遍）
- [ ] `pnpm site` 通过
- [ ] Commit: `test(admin-react): e2e 覆盖新增页面`

---

### Task 6: vue e2e 扩展 + 终验

**Files:**
- 同 Task 5 的 vue 版（与 react 版 e2e 断言保持一致，react 版为对齐基准）

- [ ] 移植并跑绿（两遍）
- [ ] `pnpm site` 通过
- [ ] Commit: `test(admin-vue): e2e 覆盖新增页面`

---

## 执行编排

并发对：Task 1 ∥ Task 2（目录不相交，git add 各自目录）→ 审查 → Task 3 ∥ Task 4 → 审查 → Task 5 ∥ Task 6 → 终审。
门户卡片「11 页面」文案如需更新，由控制器收口统一处理。
