import Dexie, { type EntityTable } from 'dexie'
import type {
  Activity,
  Comment,
  Cycle,
  Issue,
  Notification,
  Project,
  Member,
  SavedView,
  Role,
} from '@/types'

export interface SettingRow {
  key: string
  value: unknown
  updatedAt: number
}

export class PMDatabase extends Dexie {
  issues!: EntityTable<Issue, 'id'>
  projects!: EntityTable<Project, 'id'>
  members!: EntityTable<Member, 'id'>
  comments!: EntityTable<Comment, 'id'>
  savedViews!: EntityTable<SavedView, 'id'>
  activities!: EntityTable<Activity, 'id'>
  settings!: EntityTable<SettingRow, 'key'>
  cycles!: EntityTable<Cycle, 'id'>
  notifications!: EntityTable<Notification, 'id'>
  roles!: EntityTable<Role, 'id'>

  constructor(name = 'oas-pm') {
    super(name)
    this.version(1).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt]',
      projects: 'id, key',
      members: 'id, role',
    })
    // v2：[projectId+status+updatedAt] 支撑「按状态筛选 + 按更新时间排序」索引直取，
    // 免去全量结果载入内存排序（10W 级必须走 index 游标）
    this.version(2).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt]',
      projects: 'id, key',
      members: 'id, role',
    })
    // v3：评论表（详情抽屉评论区）
    this.version(3).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
    })
    // v4：保存的视图 + 活动历史 + 创建趋势（createdAt 索引）
    this.version(4).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, createdAt, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
      savedViews: 'id, name',
      activities: 'id, issueId, [issueId+createdAt], createdAt',
    })
    // v5：子任务（parentId 索引支撑子任务列表直取）
    this.version(5).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, parentId, createdAt, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
      savedViews: 'id, name',
      activities: 'id, issueId, [issueId+createdAt], createdAt',
    })
    this.version(6).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, parentId, createdAt, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
      savedViews: 'id, name',
      activities: 'id, issueId, [issueId+createdAt], createdAt',
      settings: 'key',
    })
    this.version(7).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, parentId, createdAt, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt], [assigneeId+status]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
      savedViews: 'id, name',
      activities: 'id, issueId, [issueId+createdAt], createdAt',
      settings: 'key',
    })
    // v8：全部项目作用域（跨项目窗口）——[status+updatedAt] 支撑「跨项目 + 状态筛选」
    // 按索引直取；无状态时走既有的 updatedAt 索引。只增索引，不重建数据。
    this.version(8).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, parentId, createdAt, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt], [assigneeId+status], [status+updatedAt]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
      savedViews: 'id, name',
      activities: 'id, issueId, [issueId+createdAt], createdAt',
      settings: 'key',
    })
    // v9：迭代（Cycle）。cycles 只增表；issues 增 cycleId 单列 + [projectId+cycleId]——
    // 删除周期后按 cycleId 解除归属、阶段 2 的「迭代内工作项」都走这两条索引。
    // 存量 issue 无 cycleId（不落空串），读取处一律 ?? null。
    this.version(9).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, parentId, cycleId, createdAt, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt], [assigneeId+status], [status+updatedAt], [projectId+cycleId]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
      savedViews: 'id, name',
      activities: 'id, issueId, [issueId+createdAt], createdAt',
      settings: 'key',
      cycles: 'id, projectId, [projectId+startAt]',
    })
    // v10：站内通知。memberId 必须独立成索引（复合索引首字段），否则 Dexie 拒绝建表；
    // [memberId+createdAt] 支撑「本人通知倒序」，[memberId+readAt] 只索引已读行——
    // IndexedDB 不接受 null 作为索引键，未读行天然不在该索引里，未读计数走 memberId 索引 + filter。
    this.version(10).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, parentId, cycleId, createdAt, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt], [assigneeId+status], [status+updatedAt], [projectId+cycleId]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
      savedViews: 'id, name',
      activities: 'id, issueId, [issueId+createdAt], createdAt',
      settings: 'key',
      cycles: 'id, projectId, [projectId+startAt]',
      notifications: 'id, memberId, createdAt, [memberId+createdAt], [memberId+readAt]',
    })
    // v11：软删除。issues 增 deletedAt 索引——IndexedDB 不索引 null/undefined，
    // 索引里只剩「已删除」这一小撮行，回收站与计数扣减都走索引直取，不扫全表（10W 行）。
    // 不重建数据：老行的 deletedAt 缺失即视为未删除
    this.version(11).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, parentId, cycleId, createdAt, updatedAt, deletedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt], [assigneeId+status], [status+updatedAt], [projectId+cycleId]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
      savedViews: 'id, name',
      activities: 'id, issueId, [issueId+createdAt], createdAt',
      settings: 'key',
      cycles: 'id, projectId, [projectId+startAt]',
      notifications: 'id, memberId, createdAt, [memberId+createdAt], [memberId+readAt]',
    })
    // v12：角色表。内置 admin/member/viewer 只读；自定义角色存 permissions 集合
    this.version(12).stores({
      issues:
        'id, projectId, key, status, priority, assigneeId, parentId, cycleId, createdAt, updatedAt, deletedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt], [projectId+status+updatedAt], [assigneeId+status], [status+updatedAt], [projectId+cycleId]',
      projects: 'id, key',
      members: 'id, role',
      comments: 'id, issueId, [issueId+createdAt]',
      savedViews: 'id, name',
      activities: 'id, issueId, [issueId+createdAt], createdAt',
      settings: 'key',
      cycles: 'id, projectId, [projectId+startAt]',
      notifications: 'id, memberId, createdAt, [memberId+createdAt], [memberId+readAt]',
      roles: 'id, name',
    })
  }
}

export const db = new PMDatabase()
