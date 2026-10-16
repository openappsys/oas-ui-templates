import Dexie, { type EntityTable } from 'dexie'
import type { Activity, Comment, Issue, Project, Member, SavedView } from '@/types'

export class PMDatabase extends Dexie {
  issues!: EntityTable<Issue, 'id'>
  projects!: EntityTable<Project, 'id'>
  members!: EntityTable<Member, 'id'>
  comments!: EntityTable<Comment, 'id'>
  savedViews!: EntityTable<SavedView, 'id'>
  activities!: EntityTable<Activity, 'id'>

  constructor() {
    super('oas-pm')
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
  }
}

export const db = new PMDatabase()
