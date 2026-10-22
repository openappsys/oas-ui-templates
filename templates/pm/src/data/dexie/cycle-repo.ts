import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { CreateCycleInput, CycleRepository } from '@/data/types'
import { ALL_PROJECTS } from '@/lib/filters'
import type { Cycle } from '@/types'

/** startAt 倒序，并列时按 id 倒序——与 API 实现（mock-server 的 byStartDesc）同一并列规则，
 *  否则同 startAt 的两个周期在两种数据源里会换位 */
function byStartDesc(a: Cycle, b: Cycle): number {
  if (b.startAt !== a.startAt) return b.startAt - a.startAt
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

function readCycles(db: PMDatabase, projectId: string): Promise<Cycle[]> {
  // 全部项目作用域：跨项目并集（侧栏「当前迭代」在 workspace 级也要能派生）
  if (projectId === ALL_PROJECTS) return db.cycles.toArray().then((rows) => rows.sort(byStartDesc))
  return db.cycles
    .where('[projectId+startAt]')
    .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
    .reverse()
    .toArray()
}

export function createDexieCycleRepository(db: PMDatabase): CycleRepository {
  return {
    all: (projectId) => readCycles(db, projectId),

    liveAll: (projectId) => fromLiveQuery(() => readCycles(db, projectId)),

    async create(input: CreateCycleInput): Promise<Cycle> {
      const now = Date.now()
      const cycle: Cycle = {
        id: nanoid(),
        projectId: input.projectId,
        name: input.name,
        startAt: input.startAt,
        endAt: input.endAt,
        ...(input.goal ? { goal: input.goal } : {}),
        createdAt: now,
        updatedAt: now,
      }
      await db.cycles.add(cycle)
      return cycle
    },

    async update(id, changes) {
      await db.cycles.update(id, { ...changes, updatedAt: Date.now() })
    },

    async delete(id) {
      // 同事务解除归属：迭代没了但 Issue 不能连带消失，退回「未入迭代」
      await db.transaction('rw', db.cycles, db.issues, async () => {
        const owned = await db.issues.where('cycleId').equals(id).toArray()
        const now = Date.now()
        for (const issue of owned)
          await db.issues.update(issue.id, { cycleId: null, updatedAt: now })
        await db.cycles.delete(id)
      })
    },
  }
}
