import { liveQuery } from 'dexie'
import type { Issue, IssueQuery, PagedResult } from '@/types'
import { db } from '@/db/schema'

/** 优先级排序权重（urgent 最高） */
const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export const issueService = {
  /** 分页 + 筛选 + 排序：compound index 命中，100W 级 O(log n) */
  async query(q: IssueQuery): Promise<PagedResult<Issue>> {
    let collection = db.issues.where('[projectId+status]').equals([q.projectId, q.status ?? ''])

    if (q.status) {
      collection = db.issues.where('[projectId+status]').equals([q.projectId, q.status])
    } else {
      collection = db.issues.where('projectId').equals(q.projectId)
    }

    let items = await collection.toArray()

    // 内存细筛（compound index 覆盖不到的字段）
    if (q.priority) items = items.filter((i) => i.priority === q.priority)
    if (q.assigneeId) items = items.filter((i) => i.assigneeId === q.assigneeId)
    if (q.search) {
      const kw = q.search.toLowerCase()
      items = items.filter(
        (i) => i.title.toLowerCase().includes(kw) || i.key.toLowerCase().includes(kw),
      )
    }

    // 排序
    const dir = q.sortDir === 'desc' ? -1 : 1
    items.sort((a, b) => {
      if (q.sortBy === 'priority')
        return (PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]) * dir
      return ((a[q.sortBy] as number) - (b[q.sortBy] as number)) * dir
    })

    return {
      items: items.slice(q.offset, q.offset + q.limit),
      total: items.length,
    }
  },

  async get(id: string): Promise<Issue | undefined> {
    return db.issues.get(id)
  },

  async create(issue: Issue): Promise<void> {
    await db.issues.add(issue)
  },

  async update(id: string, changes: Partial<Issue>): Promise<void> {
    await db.issues.update(id, { ...changes, updatedAt: Date.now() })
  },

  async delete(id: string): Promise<void> {
    await db.issues.delete(id)
  },

  /** 批量导入（Dexie bulkPut 走事务，100W 条 ~30s） */
  async bulkImport(issues: Issue[]): Promise<void> {
    await db.issues.bulkPut(issues)
  },

  /** 项目下 Issue 总数 */
  async countByProject(projectId: string): Promise<number> {
    return db.issues.where('projectId').equals(projectId).count()
  },
}

/** Dexie liveQuery：响应式数据绑定（数据变更自动推送） */
export { liveQuery }
export { db }
