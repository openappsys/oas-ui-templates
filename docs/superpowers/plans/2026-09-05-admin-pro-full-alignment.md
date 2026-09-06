# admin-pro react/vue 全量对齐 vanilla 实现计划（页面补齐收尾）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 把 react/vue 两端从 11 页子集补齐到与 vanilla-html 26 页功能表完全等价（一次性对齐终态；此后两端按用户决策各自演化）。

**Architecture:** 页面模式已被 products/users 打样固化；剩余 11 页的数据层（orders/logs/system/categories 等）在 Task 2 已全量移植并带测试。本计划纯粹是页面组件移植 + 路由表补齐 + e2e 扩展。

**Tech Stack:** 同既有两模版。

## Global Constraints

- 只动 `templates/admin-pro/react/` 与 `templates/admin-pro/vue/` 各自目录；不动 vanilla/cdn/site
- 路由表 meta（path/titleKey/icon/iconColor/roles/hidden/group/parent）以 vanilla `routes.ts` 为唯一事实来源逐字对齐
- 页面行为/DOM/类名/data-testid 以 vanilla 同名页面为事实来源；两端保持一致
- 各页面级 CSS 从 vanilla 原样复制（dept.css/dict.css/logs.css；category 复用 dict.css，与 vanilla 一致）
- i18n key 语言包已全量存在，无需新增；若发现缺 key 属移植错误，报告并修
- 单文件 ≤400 行（贴线时拆子组件）；每个新页面文件头写「事实来源 + 偏差因果链」
- commit message：`feat(admin-react): ...` / `feat(admin-vue): ...` 中文 conventional
- 每任务完成门槛：两端各自 `test` 全绿 + `build` 通过

## Task 1（react）/ Task 2（vue）: orders + order-detail + result + category + logs

- 移植 vanilla `pages/orders.ts`(448) / `order-detail.ts`(230) / `result.ts`(75) / `category.ts`(317) / `logs.ts`(402)
- 路由 meta 对齐 vanilla routes.ts（order-detail 是 hidden+parent=/orders 的真实隐藏路由场景）
- CSS：logs.css 从 vanilla 复制；category 复用 dict.css（同 vanilla）
- 依赖数据层（已就位）：data/orders、data/logs、data/categories、data/system
- e2e 前置：tabs.spec 的「隐藏路由归父」目前用 /products/edit 代替，本任务后可保持不变（不强制改），由 Task 5 统一评估

## Task 3（react）/ Task 4（vue）: dept + dict + menus + roles + basic-form + form

- 移植 vanilla `pages/dept.ts`(445) / `dict.ts`(439) / `menus.ts`(505) / `roles.ts`(352) / `basic-form.ts`(150) / `form.ts`(402)
- CSS：dept.css、dict.css 从 vanilla 复制
- 依赖数据层（已就位）：data/system（dept/dict/menu/role 四组 CRUD + treeDepts/treeMenus）
- 建议拆子组件（单文件 ≤400 行）

## Task 5（react）/ Task 6（vue）: e2e 扩展 + 终验

- 移植 vanilla e2e 中覆盖新页面的用例：system.spec、system2.spec、logs.spec、form.spec、misc.spec 中与 11 个新页面相关的部分（pages.spec 的页面可达性用例按新页面补齐）
- 两端 spec 断言保持一致（react 版为对齐基准）
- 终验：两端 test 全绿 + build + 全量 e2e 绿 + `pnpm site` 通过
- 门户 site/index.html 卡片文案如需微调（「11 页面」表述），由控制器统一处理

## 执行编排

并发对：Task 1 ∥ Task 2（两框架并行，目录不相交）→ 审查 → Task 3 ∥ Task 4 → 审查 → Task 5 ∥ Task 6 → 终审。
