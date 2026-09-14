# admin-pro/cdn + cdn-mpa 全量对齐 vanilla 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** cdn 与 cdn-mpa 从 4 页补齐到与 vanilla-html 23 条路由功能表完全等价（用户 2026-09-13 拍板，推翻此前「保持轻量」定位）。

**Architecture:** 数据层从 vanilla `data/*.ts` 去 TS 化移植为纯 JS（9 个模块）；页面按 vanilla 同名页为事实来源移植——cdn 用模板字符串渲染（`pages.js` 分函数），cdn-mpa 每页独立 HTML + 共享 `js/shell.js`。**零构建红线**：不允许引入任何打包器/框架，纯原生 JS。

**Tech Stack:** 原生 JS（ESM）+ unpkg CDN 引入 @oas-ui/ui@2（floating 相对路径 `../..` 上溯在 http server 下已验证可用）

## Global Constraints

- cdn 只动 `templates/admin-pro/cdn/`；mpa 只动 `templates/admin-pro/cdn-mpa/`；互不交叉
- 零构建红线：不引打包器/框架/npm 依赖；页面逻辑纯原生 JS
- 路由/页面行为以 vanilla 同名页为事实来源；DOM/类名/testid 对齐（e2e 复用）
- localStorage 键名前缀：cdn 用 `oas-admin-cdn.*`、mpa 用 `oas-admin-cdn-mpa.*`（既有约定延续）
- i18n：key 跟随 vanilla 英文键名逐字对齐（`nav.roles` 等），中英两份字典同步补
- 每任务完成门槛：`playwright test`（既有 spec）全绿 + 新页面 dev 走查
- commit message 中文 conventional commits；代码注释中文
- 单文件 ≤400 行（mpa 每页 HTML 除外；**i18n 字典文件豁免**——数据表性质，拆散有害，文件头注释声明即可）

---

### Task 1: cdn 共享层——data 模块 JS 化 + 路由表 + i18n 批量补 key

**Files:**
- Create: `templates/admin-pro/cdn/data/`——`users.js` `orders.js` `products.js` `categories.js` `system.js`（dept/dict/menu/role 四组 + treeDepts/treeMenus）`logs.js` `board.js` `dashboard.js` `adv-form.js`（从 vanilla `data/*.ts` 去 TS 移植，保留 delay 模拟与种子数据；各模块附移植单测可选）
- Modify: `templates/admin-pro/cdn/pages.js`（路由表扩到 23 条）、`i18n.js`（中英字典补齐 vanilla 全部 key：nav.* / settings.* 65 / menus / dict / dept / roles / logs / board / adv / basic / profile / result / common.* 等）

- [ ] data 模块移植（去类型标注，逻辑/种子逐字保留）
- [ ] 路由表 23 条 + i18n 双语字典补齐
- [ ] 既有 e2e 6 例全绿 + dev 冒烟
- [ ] Commit: `feat(admin-cdn): data 层移植 + 路由表全量化 + i18n 补齐`

### Task 2: cdn-mpa 共享层——同 data 模块 + i18n

**Files:**
- Create: `templates/admin-pro/cdn-mpa/js/data/`（同 Task 1 的 9 模块，从 cdn 复制零漂移）
- Modify: `js/i18n.js`（字典补齐）、`js/shell.js`（导航菜单项扩到 23 条；面包屑/标题按页注入）

- [ ] data 层复制（diff 零漂移）+ i18n 补齐 + 菜单扩全
- [ ] 既有 e2e 6 例全绿
- [ ] Commit: `feat(admin-vue→mpa): ...`——message 用 `feat(admin-cdn-mpa): data 层 + i18n 补齐 + 导航扩全`

### Task 3: cdn 页面批 A——orders / order-detail / products / product-edit / data-board / result / profile + forbidden / not-found / 500

- 移植 vanilla 同名页（orders 参照 react 版拆 orders-table/orders-drawer 函数；分页 hidden 用命令式补写；order-detail 用 sessionStorage `order-detail-id`）
- 验证：既有 e2e 全绿 + 新页 dev 走查
- Commit: `feat(admin-cdn): orders/products/data-board/result/profile/错误页`

### Task 4: cdn-mpa 页面批 A——同上 10 页（每页一个 HTML）

- MPA 差异：页间传参用 query/order-detail.html 读 sessionStorage；每页 head 内引共享 css/js
- Commit: `feat(admin-cdn-mpa): orders/products/data-board/result/profile/错误页`

### Task 5: cdn 页面批 B——roles / menus / dept / category / dict / logs / settings / basic-form / advanced-form

- 树形 expanded=JSON 数组契约（2.5.0）；settings 四 Tab + 路由模式切换（MPA/SPA 场景 settings 的路由模式控件**隐藏**——cdn/cdn-mpa 无双模式概念）※ 隐藏与否以 vanilla 行为为准：vanilla 有该控件，但 cdn 无 router-mode 概念，隐藏并在 i18n 注明
- Commit: `feat(admin-cdn): 系统管理四件套 + 表单三件套 + settings`

### Task 6: cdn-mpa 页面批 B——同上 9 页

- Commit: `feat(admin-cdn-mpa): 系统管理四件套 + 表单三件套 + settings`

### Task 7: e2e 扩展 + 终验

- cdn/cdn-mpa 各自 e2e 从 6 例扩到覆盖新增页面核心流程（对齐 react 版断言，去掉框架特有项）
- `pnpm site` 全量聚合（8 模版）；门户卡片文案「轻量后台」改「完整后台」+ README 行同步
- Commit: `test(admin-cdn,admin-cdn-mpa): e2e 全量覆盖`

## 执行编排

Task 1 ∥ Task 2（不同目录并发）→ Task 3 ∥ Task 4 → Task 5 ∥ Task 6 → Task 7 → 收口（门户/README）。
