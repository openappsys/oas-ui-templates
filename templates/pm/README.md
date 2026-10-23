# OAS PM（pm）项目管理系统模板

> 状态：**可用（2026-10-22）**——260 单测 + 135 e2e 全绿

基于 oas-ui 的项目管理系统模板：**React 19 + Dexie（IndexedDB）+ @oas-ui/ui**。
演示「生产级前端基线」：Repository 数据层（可换 REST 适配器）、三级权限模型、六大视图、中英双语、明暗双主题。

## 功能

- **仪表盘**：全局统计 / 状态分布 / 成员负载 Top / 近 30 天趋势
- **列表**：10W+ Issue 虚拟化渲染 + 触底续载（500 起步）、多维度筛选（项目/视图/状态/成员/迭代/搜索）、排序与分组、批量操作
- **看板**：状态列拖拽（权限门禁 + 回弹）
- **时间线**：甘特图（项目分组 / 进度 / 里程碑 / 逾期约束 / 拖拽改期写回）
- **资源**：成员负载泳道 / 超载高亮 / 拖拽改期与转派 / **一键均载**（levelResources reassign，admin）
- **日程**：月历 / 周时刻轴 / 议程，截止日**全天 / 上午 / 下午**三档，拖拽归档写回 + 详情抽屉联动
- **通知中心**：顶栏铃铛 + 未读角标（0 隐藏），右侧面板汇总 @提及 / 指派 / 评论 / 关闭状态四类通知，支持单条已读、全部已读，点击跳转对应 Issue
- **管理控制台**（admin）：项目 / 成员 / 权限 / 标签 / 设置 / 总览六页签
- **通用**：三级权限（admin / member / viewer，操作点 UI 拦截）、中英双语一键切换、明暗双主题、Cmd+K 命令面板、快捷键

## 运行

```bash
pnpm install
pnpm dev        # 开发（vite）
pnpm test       # 单测（vitest + fake-indexeddb）
pnpm test:e2e   # e2e（playwright，需本地 Chromium）
PW_BROWSER=firefox pnpm test:e2e   # 同一套用例跑 Firefox（需 pnpm exec playwright install firefox）
pnpm build      # tsc6 类型检查 + vite 产物
```

## 数据

IndexedDB（Dexie）本地持久化；首启自动 seed 演示数据（10 万 Issue、8 成员、3 项目、3 个迭代，清 localStorage `oas-pm-seed-v9` 重播）。数据层为 Repository 接口 + React Context 注入，默认 Dexie 实现，可替换为 REST 适配器。

**REST 示范（API 模式）**：同一套 Repository 接口另有一份 HTTP 实现（`src/data/api/client.ts`），后端由零依赖 Vite 中间件承载（`src/data/api/mock-server.ts`：2K Issue 确定性种子、revision 轮询推送、`/api/admin/reset` 复位）。开发模式下点页头数据源徽标可在「本地 / API」间切换（`localStorage 'oas-pm-data'`）；构建产物固定本地模式。`PATCH /api/issues/:id` 等写操作对同一进程内所有标签页实时可见。

## 结构

```
src/
├── views/        # dashboard / list / board / timeline / resource / schedule / issue(抽屉) / admin
├── components/   # oas-* React 桥接（oas-wrappers）、SideList、CommandPalette、BulkBar 等
├── data/         # Repository 接口 + dexie 实现 + Context 注入 + useObservable
├── permission/   # can() 策略（角色 × 操作 × 上下文）
├── lib/          # 派生层（resource-data / schedule-data / filters / colors 等，纯函数 + 单测）
├── i18n.ts       # zh/en 双词典 + t() + 活动日志渲染映射
└── seed-db.ts    # 演示数据生成（版本号重播）
```

---

# OAS PM (pm) — Project Management Template

> Status: **Stable (2026-10-23)** — 271 unit + 143 e2e tests green

A project-management template built on oas-ui: **React 19 + Dexie (IndexedDB) + @oas-ui/ui**.
A production-grade frontend baseline: Repository data layer (REST-adapter ready), 3-level permission model, six views, zh-en i18n, dual theme.

## Features

- **Dashboard**: global stats / status distribution / top member workloads / 30-day trend
- **List**: 100K+ virtualized issues with infinite scroll (500-row window), multi-facet filters (project / view / status / member / cycle / search), sorting & grouping, bulk operations
- **Board**: status-column drag & drop (permission-gated, bounce-back on deny)
- **Timeline**: gantt (project groups / progress / milestones / overdue constraints / drag-reschedule writeback)
- **Resource**: member workload swimlanes / overload highlighting / drag reschedule & reassign / **one-click load leveling** (levelResources reassign mode, admin)
- **Schedule**: month / week time-axis / agenda views, due dates in **all-day / AM / PM** buckets, drag-to-bucket writeback + detail drawer
- **Notifications**: bell with an unread badge (hidden at zero) and a right-side panel for mentions, assignments, comments, and closing status changes. Read one row or mark all read. Click a row to open the issue.
- **Soft delete**: delete moves an issue to the trash. A 6-second undo bar offers one-click restore. Admin trash (Work items tab) lists deleted rows with restore and delete-forever actions. Every query excludes deleted rows.
- **Admin console** (admin): projects / members / permissions / labels / trash / settings / overview
- **General**: 3-level permissions (admin / member / viewer, per-action UI gating), one-click zh-en switch, light/dark themes, Cmd+K command palette, keyboard shortcuts

## Run

```bash
pnpm install
pnpm dev        # dev server (vite)
pnpm test       # unit tests (vitest + fake-indexeddb)
pnpm test:e2e   # e2e (playwright, requires local Chromium)
PW_BROWSER=firefox pnpm test:e2e   # same suite on Firefox (needs pnpm exec playwright install firefox)
pnpm build      # tsc6 typecheck + vite build
```

## Data

Local persistence in IndexedDB (Dexie); demo data is seeded on first launch (100K issues, 8 members, 3 projects — clear the `oas-pm-seed-v9` localStorage key to reseed). The data layer is a Repository interface injected via React Context, with Dexie as the default implementation.

**REST demo (API mode)**: a second implementation of the same Repository interface talks HTTP (`src/data/api/client.ts`). A zero-dependency Vite middleware serves the mock backend (`src/data/api/mock-server.ts`: 2K deterministic issues, revision polling, `/api/admin/reset`). In development, click the data-source badge in the header to switch between Local and API (`localStorage 'oas-pm-data'`). The built site always runs in local mode. Writes such as `PATCH /api/issues/:id` reach every open tab in the same process.

## Structure

```
src/
├── views/        # dashboard / list / board / timeline / resource / schedule / issue(drawer) / admin
├── components/   # oas-* React bridges (oas-wrappers), SideList, CommandPalette, BulkBar, etc.
├── data/         # Repository interface + dexie impl + Context injection + useObservable
├── permission/   # can() policy (role × action × context)
├── lib/          # derivation layer (resource-data / schedule-data / filters / colors; pure + unit-tested)
├── i18n.ts       # zh/en dictionaries + t() + activity-log render mapping
└── seed-db.ts    # demo data generation (versioned reseed)
```
