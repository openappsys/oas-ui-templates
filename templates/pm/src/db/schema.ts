import Dexie, { type EntityTable } from 'dexie'
import type { Comment, Issue, Project, Member } from '@/types'

export class PMDatabase extends Dexie {
  issues!: EntityTable<Issue, 'id'>
  projects!: EntityTable<Project, 'id'>
  members!: EntityTable<Member, 'id'>
  comments!: EntityTable<Comment, 'id'>

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
  }
}

export const db = new PMDatabase()
