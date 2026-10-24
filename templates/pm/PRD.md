# OAS PM 产品需求文档（PRD）

> 项目：OAS PM（项目管理模板）
> 版本：v0.3.0（2026-10-24，对应 oas-ui 2.6.3）
> 定位：本地优先（Local-first）的轻量项目管理工具模板，面向演示与二次开发基线

---

## 0. 当前实现快照（2026-10-24）

本节的数字与行为均对应当前代码；与旧版 PRD 冲突处以本节为准。

| 维度 | 现状 |
|------|------|
| 数据层 | Dexie（IndexedDB）schema **v14 / 13 张表**；Repository 接口 + React Context 注入，默认 Dexie 实现 |
| 权限 | **强制生效**：内置 `admin / member / viewer` + 自定义角色（工作区 / 项目作用域）+ 项目级覆盖 + 审计日志 |
| 管理台 | **7 个页签**：总览 / 项目 / 成员 / 迭代 / 配置（标签·状态·优先级·回收站）/ 权限（角色·访问·审计）/ 设置；页签按权限过滤 |
| 列表窗口 | `LIST_WINDOW = 200`，触底每次 `+200`；全库搜索命中上限 2000 |
| 删除 | Issue 为**软删除**（`deletedAt`），6 秒撤销条；管理台回收站可恢复 / 永久删除 |
| 备份 | 全库 JSON 导出/导入（信封 `version: 10`，13 张表）；支持清空与重置演示数据 |
| 通知 | 独立 `notifications` 表；面板展示最近 50 条；单条已读 / 全部已读；角标 `99+` |
| 个人资料 | 姓名 / 职位 / 时区 / 头像色 / 语言自助修改；资料内的邮箱与角色只读 |
| 演示数据 | 默认 100,000 Issue，可用 `localStorage['oas-pm-seed-size']` 在 1,000–100,000 之间调整；实测 44–134s；e2e 固定 5,000 |
| API 模式 | 仅开发模式可用（Vite 中间件 + 内存库）；生产构建固定 Dexie |
| 测试基线 | 313 单测（22 个测试文件）、189 个 Chromium e2e（27 个 spec 文件）；类型检查 `tsc6 --noEmit` |

---

## 1. 产品概述

### 1.1 背景与定位

OAS PM 是 oas-ui-templates 仓库下的一个**前端模板**，用于展示「用 OAS UI 组件库 + React 19 + Dexie.js 构建的类 Jira/Linear 项目管理工具」的完整形态。它是一条**可复制的实现基线**：业务方拿到模板后，可在其数据模型、视图与交互之上替换数据层、接入真实后端，快速落地自有 PM 产品。

### 1.2 核心价值主张

- **本地优先**：业务数据落在浏览器 IndexedDB，零后端即可跑通全流程；离线可用、即时响应。
- **数据量可承载**：复合索引 + 窗口取数（200）+ 虚拟列表，默认演示规模 10 万 Issue（实测载入 44–134s，随机器负载波动）。
- **六视图一体**：仪表盘、列表、看板、时间线、资源、日程覆盖 PM 常见工作方式。
- **治理能力内建**：强制权限策略、角色/项目覆盖、审计日志、软删除回收站、全库备份恢复，均在模板内闭环。
- **两套数据源同契约**：Dexie 实现与开发期 HTTP mock 共用 Repository 接口与权限策略，便于替换为真实后端。

### 1.3 目标用户与权限（已强制生效）

角色定义在 `roles` 表中：内置 `admin / member / viewer` 只读，自定义角色可编辑权限集合。

| 角色 | 权限（当前实现） |
|------|------------------|
| 管理员（admin） | 全部 15 个动作；不受项目级覆盖影响 |
| 成员（member） | 新建 Issue、发评论、保存/删除视图；编辑/改状态/改负责人**仅限自己负责或自己提交的 Issue**；编辑/删除**仅限自己的评论**；不能删除 Issue、不能批量操作、不能进入管理工作区 |
| 访客（viewer） | 只读：不能写 Issue、评论、视图，不能进入管理区 |
| 自定义角色 | 按 `permissions` 集合**无条件**授权（不区分「本人」）；`scope = project` 的角色不得包含工作区级动作 |
| 项目级覆盖 | 成员在某项目内使用覆盖角色；**工作区 admin 永不被覆盖**；项目角色只授予项目内动作 |

- 15 个动作：`issue:create/edit/delete/change-status/change-assignee`、`comment:create/edit/delete`、`view:save/delete`、`bulk:apply/delete`、`project:manage`、`member:manage`、`workspace:manage`。
- 工作区级动作（`project:manage` / `member:manage` / `workspace:manage`）**只能由工作区角色授予**；项目角色创建/更新时会被过滤。
- 自定义角色**作用域创建后不可变**；内置角色不可改不可删；角色被成员占用或被项目覆盖引用时不可删除。
- 管理台入口要求 `member:manage` / `project:manage` / `workspace:manage` 任一；页签进一步过滤。
- 每次角色/分配变更写入 `audit` 表（权限页可筛选并导出 CSV）。

> API 模式的服务端校验与客户端策略同源（`src/permission/policy.ts`），非仅 UI 拦截；详见 `docs/api.md`。

---

## 2. 产品功能全景

```
OAS PM
├── 全局框架
│   ├── 顶栏：品牌 / 数据源徽标 / 新建 Issue / 导出 CSV / 全库搜索 / 通知 / 设置菜单 / 身份与个人资料
│   └── 侧栏：视图切换、项目、我的/全部、状态/优先级/迭代筛选、保存视图、成员筛选
├── 六大视图
│   ├── 仪表盘：统计卡 + 状态分布 + 成员 Top6 + 近 30 天趋势 + 迭代燃尽/速率
│   ├── 列表：虚拟列表 + 排序/分组/筛选 + 多选批量操作
│   ├── 看板：5 状态列拖拽流转（fractional order）
│   ├── 时间线：甘特图排期 + 拖拽改期 + 依赖连线
│   ├── 资源：成员负载泳道 + 转派 + 一键均载
│   └── 日程：月/周/议程三档 + 截止日分桶拖拽
├── Issue 生命周期
│   ├── 新建（弹窗）：标题/状态/优先级/负责人
│   ├── 详情（抽屉）：状态/优先级/负责人/描述/标签/子任务/关联/评论/活动
│   ├── 删除：软删除 + 6 秒撤销（权限：issue:delete）
│   └── 批量操作：改状态/优先级/负责人/删除（权限：bulk:apply / bulk:delete）
├── 协作与上下文
│   ├── 评论（@提及、编辑、删除）
│   ├── 活动历史（字段级 diff）
│   ├── 通知（独立表；未读角标；单条/全部已读）
│   └── 保存视图（筛选组合快照）
└── 管理台（7 页签，按权限过滤）
    ├── 总览：全局统计 / 成员负载 / 项目健康度
    ├── 项目：CRUD / 负责人 / 项目成员维护
    ├── 成员：新增 / 删除 / 角色分配
    ├── 迭代：CRUD / 关闭结转
    ├── 配置：标签 / 状态 / 优先级矩阵 / 回收站
    ├── 权限：角色矩阵 / 访问（项目角色覆盖）/ 审计
    └── 设置：外观 / 语言 / 数据源 / 备份恢复 / 清空 / 重置
```

---

## 3. 数据模型

### 3.1 实体（IndexedDB 13 张表，Dexie v14）

| 表 | 关键字段 | 说明 |
|----|----------|------|
| **issues** | `id, projectId, key, title, description, status, priority, assigneeId, reporterId, labels[], startAt, dueAt, createdAt, updatedAt, order, parentId?, completedAt?, relations?, cycleId?, deletedAt?` | 工作项；`parentId` 仅一层子任务；`deletedAt` 缺失/null = 在库；`cycleId` 空 = 未入迭代 |
| **projects** | `id, name, key, description, leadId, createdAt, nextKeyNum?` | 项目；`key` 唯一；`nextKeyNum` 事务内严格递增 |
| **members** | `id, name, email, avatarColor, role, title?, timezone?` | 成员；`role` 可指向内置或自定义角色 id |
| **comments** | `id, issueId, authorId, body, createdAt, parentId?` | 纯文本评论 + `@提及` 约定；回复线程（`parentId` 存直接父评论，数据为真实树，渲染模式用户可切） |
| **savedViews** | `id, name, filters(JSON), createdAt` | 保存的筛选视图（不含 search） |
| **activities** | `id, issueId, actorId, type, field?, from?, to?, createdAt` | 字段级活动审计 |
| **settings** | `key, value, updatedAt` | 键值配置（如标签库） |
| **cycles** | `id, projectId, name, startAt, endAt, goal?, createdAt, updatedAt` | 迭代；状态由 `now` 与区间派生，不落 status |
| **notifications** | `id, memberId, type, issueId?, actorId?, message?, readAt, createdAt` | 接收者视角的站内通知；`readAt = null` 未读 |
| **roles** | `id, name, description, builtin, scope?, permissions[]` | 内置只读；`scope ∈ {workspace, project}` |
| **audit** | `id, at, actorId, action, target, detail?` | 角色/分配等管理变更（只追加） |
| **projectRoles** | `id, projectId, memberId, roleId` | 项目级角色覆盖；`id = projectId:memberId` |
| **projectMembers** | `id, projectId, memberId` | 项目成员；负责人候选与成员筛选只取当前项目成员 |

### 3.2 枚举

| 枚举 | 取值 |
|------|------|
| IssueStatus | `backlog / todo / in_progress / done / cancelled` |
| IssuePriority | `urgent / high / medium / low` |
| MemberRole | 内置 `admin / member / viewer`，或自定义角色 id（字符串） |
| RelationType | `blocks / blocked-by / relates` |
| NotificationType | `mention / assigned / comment / status / cycle / system`（当前产生前四种） |
| RoleScope | `workspace / project` |
| ActivityType | `create / status / priority / assignee / labels / description / title / dates / relations / comment / comment-edit / delete`（存储为字符串） |

### 3.3 索引策略（性能关键）

v14 的 `issues` 索引：
`id, projectId, key, status, priority, assigneeId, parentId, cycleId, createdAt, updatedAt, deletedAt,
[projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt],
[assigneeId+status], [status+updatedAt], [projectId+cycleId]`

其余表：`projects: id,key`；`members: id,role`；`comments: id,issueId,parentId,[issueId+createdAt]`；
`activities: id,issueId,[issueId+createdAt],createdAt`；`savedViews: id,name`；`settings: key`；
`cycles: id,projectId,[projectId+startAt]`；
`notifications: id,memberId,createdAt,[memberId+createdAt],[memberId+readAt]`；
`roles: id,name`；`audit: id,at,actorId,action`；
`projectRoles: id,projectId,memberId,[projectId+memberId]`；
`projectMembers: id,projectId,memberId,[projectId+memberId]`。

要点：

- `[projectId+status+updatedAt]` / `[status+updatedAt]` 支撑「状态筛选 + 更新时间排序」索引直取，10 万级不把全量结果载入内存。
- `deletedAt` 只索引软删行（IndexedDB 不索引 null/undefined），回收站与计数扣减免去扫全表。
- `[assigneeId+status]` 支撑成员负载；`[projectId+cycleId]` 支撑迭代直取。
- 复合索引首字段必须有独立索引（如 `notifications.memberId`、`projectRoles.projectId`），否则 Dexie 建表失败。

### 3.4 级联与不变式

| 操作 | 行为 |
|------|------|
| Issue 软删除 | 只写 `deletedAt`，**不改 `updatedAt`**，恢复后回到原排序位置 |
| Issue 永久删除 | 仅回收站可用；删评论 / 活动 / 通知，子任务 `parentId → null` |
| 成员删除 | Issue 指派清空；删该成员的 `projectMembers` / `projectRoles`；**最后一名 admin 不可删** |
| 项目删除 | 项目仍有 Issue 时拒绝；否则级联删 `projectMembers` / `projectRoles` / `cycles` |
| 项目成员维护 | 保存时移除不再属于该项目的成员的**项目角色覆盖** |
| 新建项目 | 自动把**当前全部成员**加入项目成员 |
| 迭代删除 | Issue 退回「未入迭代」（`cycleId = null`），不删 Issue |
| 角色删除 | 内置角色拒绝；被成员占用或被项目覆盖引用时拒绝 |
| 清空数据 | 保留内置角色 + 当前管理员；不清 seed 标记，刷新不会重播 |

---

## 4. 功能需求明细

### 4.1 全局框架

| 编号 | 功能 | 需求描述 | 验收要点 |
|------|------|----------|----------|
| F-01 | 身份切换 | 本地模式顶栏头像弹窗切换 8 个成员，持久化 `localStorage['oas-pm-user']`；API 模式改为登录（`user1–8@oas.dev`，口令 `oas`） | 切换后「我的」、通知、评论作者随之变化 |
| F-02 | 语言切换 | 中/英一键切换，偏好 `oas-pm-lang` | 核心 UI 文案双语；刷新后保持 |
| F-03 | 全库搜索 | 顶栏输入框，按 Key 或标题子串匹配（`/` 聚焦） | 命中上限 2000；空串恢复窗口列表 |
| F-04 | CSV 导出 | 导出当前已加载窗口（Key/标题/状态/优先级/负责人/创建日期） | UTF-8 BOM；受当前窗口 200 限制，非全库 |
| F-05 | 快捷键 | `C` 新建、`/` 聚焦搜索、`?` 帮助、`Esc` 关抽屉/弹层 | 输入框聚焦时不劫持 |
| F-06 | 启动兜底 | IndexedDB 不可用/配额满时展示错误页而非白屏 | 隐私模式可见友好提示 |
| F-07 | 主题与筛选位置 | 明/暗/跟随系统；筛选控件可放侧栏 / 顶栏 / 两处 | `oas-pm-theme`、`oas-pm-filters-placement` 持久化 |
| F-08 | 数据源切换 | 顶栏数据源徽标；仅开发模式可点切「本地 / API」，构建产物只读 | 生产构建固定 Dexie |

### 4.2 仪表盘（Dashboard）

| 编号 | 功能 | 需求描述 |
|------|------|----------|
| F-09 | 统计卡片 | 全部 / Todo / In Progress / Done 四张实时计数（索引 count，扣减软删行） |
| F-10 | 状态分布图 | donut，按 5 状态计数 |
| F-11 | 成员 Top6 | bar，按成员被分配 Issue 数降序 |
| F-12 | 创建趋势 | area，近 30 天按天聚合（createdAt 范围） |
| F-13 | 迭代图表 | 当前迭代燃尽 + 最近 6 期完成量（速率） |

### 4.3 列表（Issues）

| 编号 | 功能 | 需求描述 | 验收要点 |
|------|------|----------|----------|
| F-14 | 虚拟列表 | `oas-virtual-list`，**窗口 200**，触底每次 +200 | 10 万级滚动流畅，行高固定 |
| F-15 | 排序 | 最近更新 / 优先级 / 创建时间 | 状态筛选 + 更新排序走复合索引 |
| F-16 | 分组 | 不分组 / 按优先级 / 按负责人；组内预览前 30 条 | 组标题带计数 |
| F-17 | 筛选 | 项目（含全部项目）/ 状态多选 / 优先级 / 负责人 / 迭代 / 我的 / 搜索 | 侧栏与顶栏同一份状态 |
| F-18 | 多选 | 行首 checkbox，多选后出现批量条 | 受 `bulk:apply` / `bulk:delete` 约束 |
| F-19 | 清除筛选 / 保存视图 | 清空筛选；把当前筛选（不含 search）存为命名视图 | 可应用 / 删除；受 `view:save` / `view:delete` |

### 4.4 看板（Board）

| 编号 | 功能 | 需求描述 | 验收要点 |
|------|------|----------|----------|
| F-20 | 状态流转 | 5 状态列，卡片拖拽改状态 | 落库 status + updatedAt；无权限时回弹并提示 |
| F-21 | 列内排序 | fractional order（prev/next 取中值） | 边界步进 |
| F-22 | 卡片点击 | 打开详情抽屉 | 与拖拽不冲突 |

### 4.5 时间线（Timeline）

| 编号 | 功能 | 需求描述 | 验收要点 |
|------|------|----------|----------|
| F-23 | 甘特图 | 展示「有截止日期且 `dueAt > createdAt`」的 Issue，最多 50 条 | 无数据空态 |
| F-24 | 拖拽改期 | 拖拽/拉伸写回 `startAt / dueAt` | liveQuery 自动刷新 |
| F-25 | 依赖连线 | 相邻任务 fs 依赖 + 里程碑（紧急且无截止日，最多 5 个） | 渲染正确 |

### 4.6 资源与日程

| 编号 | 功能 | 需求描述 |
|------|------|----------|
| F-26 | 资源泳道 | 按成员汇总负载、超载高亮、拖拽改期/转派 |
| F-27 | 一键均载 | `levelResources` 重新分配，需 `bulk:apply`（内置 admin 具备；自定义角色可授予） |
| F-28 | 日程视图 | 月历 / 周时刻轴 / 议程；截止日全天 / 上午 / 下午三档，拖拽归档写回 |

### 4.7 Issue 生命周期

| 编号 | 功能 | 需求描述 | 验收要点 |
|------|------|----------|----------|
| F-29 | 新建 | 标题/状态/优先级/负责人；标题必填 | Key 事务内 `nextKeyNum` 递增 |
| F-30 | 详情抽屉 | 即时保存状态/优先级/负责人/描述/标签 | 字段变更写活动；权限按动作 + 上下文判定 |
| F-31 | 子任务 | 一层子任务：添加、勾选完成/还原、跳转 | 独立 Issue（`parentId`） |
| F-32 | 关联 | 添加/移除 `blocks / blocked-by / relates` | 候选集为当前项目前 100 条存活 Issue |
| F-33 | 标签 | 预置标签 + 自由输入（`oas-dynamic-tags`） | 增删即时保存 |
| F-34 | 评论 | 添加/编辑/删除；回复线程（数据为真实树）；三种显示模式用户可切：**无嵌套**（时间轴 + ↳标记）/ **一级嵌套**（回复挂根，后代平铺）/ **无限嵌套**（整棵树逐层渲染）；`@中英文名` 高亮 | 成员仅作者本人可改删（admin 不受限）；模式偏好本地持久化 |
| F-35 | 活动历史 | 字段级 diff（谁/改什么/从→到/何时） | 状态→done 记录 `completedAt` |
| F-36 | 软删除与撤销 | 删除只写 `deletedAt`，顶部 6 秒撤销条可批量恢复 | `updatedAt` 不变，恢复后回原位 |
| F-37 | 批量操作 | 改状态/优先级/负责人在事务内逐条写并记活动（`bulk:apply`）；批量删除为软删除（`bulk:delete`） | 已删除行不参与改写 |

### 4.8 通知

| 编号 | 功能 | 需求描述 | 验收要点 |
|------|------|----------|----------|
| F-38 | 通知中心 | 独立 `notifications` 表；面板取最近 50 条；未读角标（>99 显示 99+） | 点击单条标已读并跳转 Issue |
| F-39 | 全部已读 | 一键把本人未读置为已读 | 不影响他人 |
| F-40 | 生成规则 | 评论 @提及 → mention；评论 → comment（负责人）；改派 → assigned；关闭类状态 → status | 不通知操作者；解除指派不通知 |

### 4.9 管理台（7 页签）

| 编号 | 页签 | 所需权限 | 需求描述 |
|------|------|----------|----------|
| F-41 | 总览 | 进入管理区即可 | 全局统计、成员负载、项目健康度（逾期/未指派/停滞；扣除软删） |
| F-42 | 项目 | `project:manage` | 项目 CRUD（key 唯一）；选择负责人；维护项目成员；删除需项目无 Issue |
| F-43 | 成员 | `member:manage` | 成员新增/删除；角色分配（工作区角色）；最后管理员保护；删除级联 |
| F-44 | 迭代 | `project:manage` | 迭代 CRUD；区间校验与重叠提示；关闭结转未完成项到下一迭代或移出 |
| F-45 | 配置 | `workspace:manage` | 标签库编辑；状态/优先级展示；回收站（恢复 / 永久删除） |
| F-46 | 权限 | `project:manage` 或 `workspace:manage` | 角色矩阵（内置只读）；自定义角色 CRUD；项目角色覆盖（成员取自项目成员，可清除）；审计日志（默认 20 条，+20 加载，支持筛选与 CSV 导出） |
| F-47 | 设置 | `workspace:manage` | 主题/语言；全库 JSON 备份导出、导入、重置演示数据、清空数据 |

> 页签过滤：无权限的页签不渲染；当前页签失权时回落到第一个可见页签。管理区入口本身要求任一管理动作。

### 4.10 数据初始化与数据源

| 编号 | 功能 | 需求描述 |
|------|------|----------|
| F-48 | 本地演示数据 | Dexie seed：**2 项目、8 成员、3 迭代、2 示例保存视图、默认 100,000 Issue**（确定性 `mulberry32(42)`），5000 一块批量写入 |
| F-49 | 可调播种规模 | `localStorage['oas-pm-seed-size']`，取值夹取到 `[1000, 100000]`；空/非法回落 100,000；e2e 固定 5000 |
| F-50 | Seed 幂等 | `oas-pm-seed-v11` 标记；已标记时只补内置角色与项目成员，不重播数据 |
| F-51 | API mock | 仅开发模式：Vite 中间件 + 内存库；**3 项目、8 成员、3 迭代、2,000 Issue**；重启 dev server 复位 |
| F-52 | 备份/恢复 | 信封 `{app:'oas-pm', version:10, exportedAt, tables}` 覆盖全部 13 张表（含回收站行）；导入先清空再 bulkPut |
| F-53 | 清空 / 重置 | 清空保留内置角色 + 当前管理员且不重播；重置演示数据清标记后重新 seed |

---

## 5. 非功能需求

| 类别 | 需求 | 指标 |
|------|------|------|
| 性能 | 列表/筛选/排序 | 默认窗口 200（+200 续载）；搜索上限 2000；索引直取 |
| 性能 | 10 万 Issue 播种 | 实测 44–134s（随机器负载波动）；分块 5000 `bulkPut`；期间显示准备屏 |
| 可用性 | 离线可用 | 除开发期 API 模式外不依赖网络 |
| 可用性 | 窄屏降级 | 侧栏折叠、抽屉全屏；**无独立移动端 Playwright 工程** |
| 国际化 | 中英双语 | 应用文案全覆盖；组件内建文案（确认/取消/占位/关闭）经 `@oas-ui/i18n` 随语言切换 |
| 可访问性 | 键盘可达 | 行 Enter/Space 打开、`Esc` 关闭、`/` 搜索、`?` 帮助 |
| 健壮性 | 启动兜底 | IndexedDB 异常/配额满展示错误页 |
| 数据安全 | 管理操作可追溯 | 角色/分配变更写审计；审计可筛选导出 CSV |

---

## 6. 产品功能边界

### 6.1 仍未实现（明确不做）

| 边界项 | 说明 |
|--------|------|
| ❌ 团队 / 用户组 | 无 team/group 实体，权限只到成员与项目两级 |
| ❌ 访客（guest）角色 | 只有 admin / member / viewer 与自定义角色；无外部访客、无链接分享 |
| ❌ SSO / SCIM | 无企业身份源、无目录同步 |
| ❌ 自定义工作流状态 / 字段 | 状态固定 5 态、字段集固定；仅标签可配置 |
| ❌ 附件 | 无文件/图片上传 |
| ❌ 富文本 / Markdown | 描述与评论为纯文本（`@提及` 文本约定高亮）；规划接入独立 oas-editor 项目，模板内不做实现 |
| ❌ 实时协作 | 无 WebSocket / 多人编辑冲突处理；同源多标签页经 revision 轮询近实时，真实多端同步随后端走 |
| ❌ 评论嵌套层级 | 三种显示模式已支持（无嵌套/一级/无限嵌套）；不做表情/点赞 |
| ❌ 服务端 / 云端同步 | 无持久后端；API mock 仅开发模式、内存态、重启即失 |
| ❌ 真实多租户认证 | 本地身份切换 / 演示登录，无组织隔离与真实鉴权 |
| ❌ 审计留存治理 | 无保留策略、无合规归档；导出仅当前筛选的 CSV |
| ❌ 全文检索 | 仅 Key/标题子串，无全文索引/拼音/模糊容错 |

### 6.2 已实现但与旧版 PRD 描述不同

| 项 | 当前事实 |
|----|----------|
| 权限 | **已强制执行**（内置角色 + 自定义角色 + 项目覆盖 + 审计）；不再是「仅展示标签」 |
| 项目 / 成员 / 迭代 | **CRUD 已实现**（管理台）；项目/成员不再只由 Seed 注入 |
| 删除 | Issue 为软删除 + 6 秒撤销 + 回收站；永久删除才物理移除并级联 |
| 备份 | 全库 JSON 备份/恢复已实现（13 表，信封 v10）；CSV 仅导出当前窗口 |
| 通知 | 独立表 + 已读/未读 + 全部已读；非「近 300 条活动派生」 |
| 迭代 | 已实现迭代 CRUD 与关闭结转；仍无容量规划/故事点 |
| 数据规模 | 默认 10 万、播种上限 100,000；未提供百万级种子与实测（旧稿「100W ~30s」作废） |
| 数据源 | 生产固定 Dexie；API mock 仅开发模式，3 项目 / 2000 Issue / 重启复位 |

---

## 7. 验收与测试基线

| 类型 | 命令 / 覆盖 | 基线 |
|------|-------------|------|
| 类型检查 | `pnpm --filter pm exec tsc6 --noEmit` | 0 错（注意 bin 是 `tsc6`，不是 `tsc`） |
| 构建 | `pnpm --filter pm run build`（tsc6 + vite） | 通过 |
| 单测 | `pnpm --filter pm run test`（vitest + fake-indexeddb） | 313 个用例 / 22 个测试文件 |
| E2E | `pnpm --filter pm exec playwright test` | 189 个 Chromium 用例 / 27 个 spec 文件；`workers: 1` |
| 截图 | `e2e/_shots.spec.ts` | 34 个截图用例；Firefox 下跳过 |
| 尺寸预算 | — | pm 无 size-budget 脚本 |

补充：

- 无移动端 Playwright project；窄屏仅有布局降级，不做独立移动端验收。
- `PW_BROWSER=firefox` 可跑同一套用例（截图 spec 除外）。
- e2e 每个用例全新上下文都重播种子，故用 5,000 条（`e2e/seed.ts`），生产默认 100,000。

**E2E 已覆盖的关键行为**：新建/详情编辑/子任务/关联/评论增删改/@提及/甘特依赖/完成趋势/通知跳转与已读/批量操作/保存视图/活动/全库搜索/i18n/主题/工具栏菜单/管理台 CRUD/角色与覆盖/审计导出/软删除与回收站/API 模式鉴权/项目成员收窄/a11y 结构。

---

## 8. 技术栈与关键约定

| 项 | 选型 |
|----|------|
| 框架 | React 19.3 |
| 数据层 | Dexie 4.4（IndexedDB）+ 自研 Observable（`useObservable`；未使用 dexie-react-hooks） |
| 状态 | React state + localStorage 偏好（无外部状态库） |
| 组件 | `@oas-ui/ui` 2.6.3（Web Components，React 侧 property/事件桥接）+ `@oas-ui/icons` + `@oas-ui/theme` + `@oas-ui/i18n`（组件内建文案 locale） |
| 构建 | Vite 8 + TypeScript 6（`typescript` 别名 `@typescript/typescript6`） |
| 测试 | Vitest 5 + fake-indexeddb；Playwright 1.64（Chromium 默认，可切 Firefox） |
| 本地优先 | IndexedDB 为唯一持久数据源；API 实现仅开发期可切换 |
| 依赖形态 | `@oas-ui/*` 通过 `link:` 指向本地 oas-ui 工作副本；`package.json` 与锁文件保留本地 link 状态、不提交 |
