import Dexie, { type EntityTable } from 'dexie'
import type { Issue, Project, Member } from '@/types'

export class PMDatabase extends Dexie {
  issues!: EntityTable<Issue, 'id'>
  projects!: EntityTable<Project, 'id'>
  members!: EntityTable<Member, 'id'>

  constructor() {
    super('oas-pm')
    this.version(1).stores({
      // compound index：[projectId+status] 支撑看板列查询
      // [projectId+assigneeId] 支撑按人筛选
      // [projectId+updatedAt] 支撑默认排序
      issues:
        'id, projectId, key, status, priority, assigneeId, updatedAt, [projectId+status], [projectId+priority], [projectId+assigneeId], [projectId+updatedAt]',
      projects: 'id, key',
      members: 'id, role',
    })
  }
}

export const db = new PMDatabase()
