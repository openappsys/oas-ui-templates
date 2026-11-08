import { nanoid } from 'nanoid'
import { fromLiveQuery } from '@/data/observable'
import type { Milestone } from '@/types'
import type { MilestoneRepository } from '@/data/types'
import type { PMDatabase } from '@/db/schema'

export function createDexieMilestoneRepository(db: PMDatabase): MilestoneRepository {
  // 排序契约 = mock-server 同口径：dueAt 升序，无日期（null 不进索引）排最后——
  // Dexie sortBy 对 null 的相对顺序随数据到达序漂移（M24 flaky 根因），显式比较
  const byDueAsc = (a: Milestone, b: Milestone) =>
    (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER)
  return {
    async all(projectId) {
      const rows = await db.milestones.where('projectId').equals(projectId).toArray()
      return rows.sort(byDueAsc)
    },
    live(projectId) {
      return fromLiveQuery(() =>
        db.milestones
          .where('projectId')
          .equals(projectId)
          .toArray()
          .then((rows) => rows.sort(byDueAsc)),
      )
    },
    async get(id) {
      return db.milestones.get(id)
    },
    liveMilestoneProgress(projectId) {
      // 每里程碑 在库总数 / done 类别完成数（索引直取；done 语义跟工作区状态类别走）
      return fromLiveQuery(async () => {
        const allProjects = projectId === '__all__'
        const states = await db.workflowStates.toArray()
        const doneIds = new Set(states.filter((s) => s.category === 'done').map((s) => s.id))
        const milestones = allProjects
          ? await db.milestones.toArray()
          : await db.milestones.where('projectId').equals(projectId).toArray()
        const deletedRows = await db.issues.where('deletedAt').above(0).toArray()
        const deleted = new Set(deletedRows.map((r) => r.id))
        const out: Array<{ milestoneId: string; total: number; done: number }> = []
        for (const m of milestones) {
          const rows = allProjects
            ? await db.issues.where('milestoneId').equals(m.id).toArray()
            : await db.issues.where('[projectId+milestoneId]').equals([projectId, m.id]).toArray()
          const aliveRows = deleted.size === 0 ? rows : rows.filter((r) => !deleted.has(r.id))
          out.push({
            milestoneId: m.id,
            total: aliveRows.length,
            done: aliveRows.filter((i) =>
              doneIds.size === 0 ? i.status === 'done' : doneIds.has(i.status),
            ).length,
          })
        }
        return out
      })
    },
    async create(input) {
      const m: Milestone = { id: nanoid(), createdAt: Date.now(), ...input }
      await db.milestones.add(m)
      return m
    },
    async update(id, changes) {
      await db.milestones.update(id, changes)
    },
    async delete(id) {
      await db.milestones.delete(id)
    },
  }
}
