# OAS PM（pm）项目管理系统模板

> 状态：可用（2026-10-24）——测试基线 313 单测 + 189 Chromium e2e（27 个 spec 文件）

基于 oas-ui 的项目管理系统模板：**React 19 + Dexie（IndexedDB）+ @oas-ui/ui**。
演示「生产级前端基线」：Repository 数据层（可换 REST 适配器）、强制权限模型（内置角色 + 自定义角色 + 项目级覆盖）、六大视图、7 页签管理台、中英双语、明暗双主题。

## 功能

- **仪表盘**：全局统计 / 状态分布 / 成员负载 Top6 / 近 30 天趋势 / 当前迭代燃尽 + 速率
- **列表**：虚拟化渲染 + 触底续载（**窗口 200**，每次 +200）、多维度筛选（项目/视图/状态/优先级/成员/迭代/搜索，筛选位置可选**侧栏 / 顶部 / 两者**）、排序与分组、批量操作
- **看板**：状态列拖拽（权限门禁 + 回弹）
- **时间线**：甘特图（最多 50 条 / 里程碑 / 逾期 / 拖拽改期写回）
- **资源**：成员负载泳道 / 超载高亮 / 拖拽改期与转派 / 一键均载（需 `bulk:apply`）
- **日程**：月历 / 周时刻轴 / 议程，截止日**全天 / 上午 / 下午**三档，拖拽归档写回
- **通知中心**：独立 `notifications` 表，顶栏铃铛 + 未读角标（>99 显示 99+，0 隐藏），右侧面板展示最近 50 条；单条已读、全部已读，点击跳转 Issue
- **软删除**：删除 Issue 进入回收站，顶部 6 秒撤销条；管理台「配置 → 回收站」可恢复或永久删除（永久删除级联清评论/活动/通知，并解除子任务挂载）
- **评论**：纯文本 + @提及高亮；回复线程（数据为真实树）；**三种显示模式可切换**：无嵌套 / 一级嵌套 / 无限嵌套（偏好本地持久化，默认一级）
- **权限（强制生效）**：15 个动作；内置 `admin / member / viewer`；自定义角色（工作区/项目作用域）；项目级角色覆盖（工作区 admin 永不被覆盖）；最后一名 admin 保护；角色被占用/被覆盖引用时禁止删除；作用域创建后不可变
- **管理台（7 页签，按权限过滤）**：总览 / 项目 / 成员 / 迭代 / 配置（标签·状态·优先级·回收站）/ 权限（角色·访问·审计）/ 设置
- **数据管理**：全库 JSON 备份导出/导入（信封 v10，13 张表）、清空（保留内置角色 + 当前管理员，不重播）、重置演示数据
- **个人资料**：姓名 / 职位 / 时区 / 头像色 / 语言自助修改；资料内的邮箱与角色只读
- **通用**：中英双语一键切换（应用文案 + 组件内建文案随语言切换）、明暗双主题、Cmd+K 命令面板、快捷键、a11y 结构基线

## 运行

**依赖前置**：`@oas-ui/ui`、`@oas-ui/theme`、`@oas-ui/icons` 通过 `link:` 指向本地 oas-ui 工作副本（`D:/dev/oas-ui/packages/*`，当前 2.6.3），需先在该仓库构建出 `dist`。`templates/pm/package.json` 与锁文件刻意保留本地 link 状态、**不提交**（提交时只 stage 显式路径，排除这两个文件）。

```bash
pnpm install
pnpm dev        # 开发服务器 http://localhost:5878（vite.config.ts 固定端口）
pnpm test       # 单测（vitest + fake-indexeddb）
pnpm exec playwright install chromium   # 首次运行 e2e 前安装浏览器
pnpm test:e2e   # e2e（playwright，Chromium）
PW_BROWSER=firefox pnpm test:e2e        # 同一套用例跑 Firefox（需 playwright install firefox；截图 spec 跳过）
pnpm build      # tsc6 类型检查 + vite 产物
```

类型检查单独跑用 `pnpm exec tsc6 --noEmit`（本模板的 TS6 编译器 bin 是 `tsc6`，不是 `tsc`）。

## 数据

### 本地模式（默认，生产构建固定此模式）

IndexedDB（Dexie，schema **v14 / 13 张表**）本地持久化；首启自动 seed 演示数据：
**2 个项目、8 个成员、3 个迭代、2 个示例保存视图、默认 100,000 条 Issue**（确定性 `mulberry32(42)`）。

- 规模可用 `localStorage['oas-pm-seed-size']` 调整，夹取到 `[1000, 100000]`；空/非法回落 100,000。
- 实测 10 万条播种 **44–134s**（随机器负载波动）；播种期间显示准备屏，避免 liveQuery 被持续写入反复重启。
- 清 `localStorage['oas-pm-seed-v11']` 后刷新会**清表重播**（会丢掉现有数据，谨慎操作）；未清标记的旧库只补内置角色与项目成员，不重播。
- e2e 每个用例都是全新上下文，固定用 **5,000** 条（`e2e/seed.ts`），与产品默认规模无关。
- 数据层为 Repository 接口 + React Context 注入，默认 Dexie 实现，可替换为 REST 适配器。

### API 模式（仅开发模式）

同一套 Repository 接口另有一份 HTTP 实现（`src/data/api/client.ts`），后端由零依赖 Vite 中间件承载（`src/data/api/mock-server.ts`）。

- 仅 `import.meta.env.DEV` 可切换；顶栏数据源徽标在开发模式可点（写入 `localStorage['oas-pm-data']`），**构建产物固定 Dexie**。
- 需要登录：账号 `user1@oas.dev` … `user8@oas.dev`，密码统一 `oas`（user1 = admin，user2/3 = member，user4–8 = viewer）；登录页提供 admin / member / viewer 三个快速登录。
- 内存库，**重启 dev server 即复位**；`POST /api/admin/reset` 也可复位。种子为 3 个项目、8 个成员、3 个迭代、2,000 条 Issue。
- 写操作按与服务端同源的策略校验权限（viewer 只读），revision 轮询让同进程多标签页近实时同步。完整契约见 `docs/api.md`。

## 测试基线

| 类型 | 命令 | 基线 |
|------|------|------|
| 类型检查 | `pnpm exec tsc6 --noEmit` | 0 错 |
| 构建 | `pnpm build` | tsc6 + vite |
| 单测 | `pnpm test` | 313 用例 / 22 文件 |
| E2E | `pnpm test:e2e` | 189 用例 / 27 spec（Chromium，`workers: 1`；无独立移动端 project） |
| 截图 | `e2e/_shots.spec.ts` | 34 个截图用例（Firefox 下跳过） |

pm 没有 size-budget 脚本。

## 结构

```
src/
├── views/        # dashboard / list / board / timeline / resource / schedule / issue(抽屉) / admin / auth
├── components/   # oas-* React 桥接（oas-wrappers）、SideList、CommandPalette、NotificationCenter、ProfileDrawer、BulkBar 等
├── data/         # Repository 接口 + dexie 实现 + api 实现 + Context 注入 + useObservable
├── db/           # Dexie schema（v1→v14）
├── permission/   # can() / roleCan() 策略（角色 × 动作 × 上下文）
├── lib/          # 派生层（resource-data / schedule-data / filters / cycles / notify / seed-size 等，纯函数 + 单测）
├── i18n.ts       # zh/en 双词典 + t() + 活动日志渲染映射
└── seed-db.ts    # 演示数据生成（版本号重播）
```

---

# OAS PM (pm) — Project Management Template

> Status: available (2026-10-24) — baseline 313 unit + 189 Chromium e2e tests (27 spec files)

A project-management template built on oas-ui: **React 19 + Dexie (IndexedDB) + @oas-ui/ui**.
A production-grade frontend baseline: Repository data layer (REST-adapter ready), enforced permissions (built-in roles + custom roles + per-project overrides), six views, a 7-tab admin console, zh-en i18n, dual theme.

## Features

- **Dashboard**: global stats / status distribution / top-6 member workloads / 30-day trend / current-cycle burndown + velocity
- **List**: virtualized rendering with infinite scroll (**200-row window**, +200 per step), multi-facet filters (project / view / status / priority / member / cycle / search) with a **sidebar / top bar / both** placement preference, sorting & grouping, bulk operations
- **Board**: status-column drag & drop (permission-gated, bounce-back on deny)
- **Timeline**: gantt (max 50 rows / milestones / overdue / drag-reschedule writeback)
- **Resource**: member workload swimlanes / overload highlighting / drag reschedule & reassign / one-click load leveling (requires `bulk:apply`)
- **Schedule**: month / week time-axis / agenda views, due dates in **all-day / AM / PM** buckets, drag-to-bucket writeback
- **Notifications**: a dedicated `notifications` table. Bell with an unread badge (>99 shows 99+, hidden at zero) and a right-side panel of the newest 50 rows. Read one row or mark all read. Click a row to open the issue.
- **Soft delete**: deleting an issue moves it to the trash with a 6-second undo bar. Admin console → Config → Trash restores or purges. A purge cascades comments/activities/notifications and detaches subtasks.
- **Comments**: plain text with @mention highlight; reply threads stored as a real tree with **three switchable display modes** — flat / threaded (one level) / fully nested (preference persisted locally, default threaded)
- **Permissions (enforced)**: 15 actions; built-in `admin / member / viewer`; custom roles (workspace/project scope); per-project role overrides (workspace admins are never overridden); last-admin guard; role delete guard when assigned or overridden; scope immutable after creation
- **Admin console (7 tabs, permission-filtered)**: overview / projects / members / cycles / config (labels, statuses, priorities, trash) / permissions (roles, access, audit) / settings
- **Data management**: full JSON backup export/import (envelope v10, 13 tables), wipe (keeps built-in roles + the current admin, does not reseed), reset demo data
- **Profile**: self-service name / job title / timezone / avatar color / language; email and role are read-only in the profile drawer
- **General**: zh-en switch (app copy **and** component built-in copy follow the language), light/dark themes, Cmd+K command palette, keyboard shortcuts, a11y structure baseline

## Run

**Dependency prerequisite**: `@oas-ui/ui`, `@oas-ui/theme` and `@oas-ui/icons` are `link:` dependencies pointing at a local oas-ui checkout (`D:/dev/oas-ui/packages/*`, currently 2.6.3); build its `dist` first. Also depends on the published `@oas-ui/i18n ^2.6.3` (built-in component copy). `templates/pm/package.json` and the lockfile intentionally keep the local link state and are **not committed** (stage explicit paths only, excluding those two files).

```bash
pnpm install
pnpm dev        # dev server at http://localhost:5878 (fixed in vite.config.ts)
pnpm test       # unit tests (vitest + fake-indexeddb)
pnpm exec playwright install chromium   # install the browser before the first e2e run
pnpm test:e2e   # e2e (playwright, Chromium)
PW_BROWSER=firefox pnpm test:e2e        # same suite on Firefox (playwright install firefox; screenshot spec skipped)
pnpm build      # tsc6 typecheck + vite build
```

Typecheck alone: `pnpm exec tsc6 --noEmit` (the TS6 compiler bin in this template is `tsc6`, not `tsc`).

## Data

### Local mode (default; production builds always use it)

Local persistence in IndexedDB (Dexie, schema **v14 / 13 tables**). Demo data is seeded on first launch:
**2 projects, 8 members, 3 cycles, 2 demo saved views, 100,000 issues by default** (deterministic `mulberry32(42)`).

- Adjust the size with `localStorage['oas-pm-seed-size']` (clamped to `[1000, 100000]`; empty/invalid falls back to 100,000).
- Measured on 100K rows: **44–134s** (varies with machine load). A preparation screen shows during seeding so live queries are not starved by continuous writes.
- Clear `localStorage['oas-pm-seed-v11']` and reload to **replay the seed** (this clears the tables and loses current data). An already-marked database only gets missing built-in roles and project members; data is not replayed.
- Every e2e test uses a fresh context, so e2e runs **5,000** rows (`e2e/seed.ts`), independent of the product default.
- The data layer is a Repository interface injected via React Context; Dexie is the default implementation and can be replaced by a REST adapter.

### API mode (development only)

A second implementation of the same Repository interface talks HTTP (`src/data/api/client.ts`). A zero-dependency Vite middleware serves the mock backend (`src/data/api/mock-server.ts`).

- Switchable only when `import.meta.env.DEV`; click the data-source badge in development (writes `localStorage['oas-pm-data']`). **Production builds always use Dexie.**
- Login required: `user1@oas.dev` … `user8@oas.dev`, password `oas` for all (user1 = admin, user2/3 = member, user4–8 = viewer). The login page offers admin / member / viewer quick logins.
- In-memory store; **restarting the dev server resets it** (`POST /api/admin/reset` also resets). Seed: 3 projects, 8 members, 3 cycles, 2,000 issues.
- Writes are checked by the same policy as the client (viewer is read-only); revision polling keeps tabs in the same process nearly live. Full contract: `docs/api.md`.

## Test baseline

| Kind | Command | Baseline |
|------|---------|----------|
| Typecheck | `pnpm exec tsc6 --noEmit` | 0 errors |
| Build | `pnpm build` | tsc6 + vite |
| Unit | `pnpm test` | 313 tests / 22 files |
| E2E | `pnpm test:e2e` | 189 tests / 27 specs (Chromium, `workers: 1`; no mobile project) |
| Screenshots | `e2e/_shots.spec.ts` | 34 screenshot tests (skipped on Firefox) |

pm has no size-budget script.

## Structure

```
src/
├── views/        # dashboard / list / board / timeline / resource / schedule / issue(drawer) / admin / auth
├── components/   # oas-* React bridges (oas-wrappers), SideList, CommandPalette, NotificationCenter, ProfileDrawer, BulkBar, etc.
├── data/         # Repository interface + dexie impl + api impl + Context injection + useObservable
├── db/           # Dexie schema (v1→v14)
├── permission/   # can() / roleCan() policy (role × action × context)
├── lib/          # derivation layer (resource-data / schedule-data / filters / cycles / notify / seed-size; pure + unit-tested)
├── i18n.ts       # zh/en dictionaries + t() + activity-log render mapping
└── seed-db.ts    # demo data generation (versioned reseed)
```
