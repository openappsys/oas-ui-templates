import type { PMDatabase } from '@/db/schema'
import type { Project } from '@/types'
import { fromLiveQuery } from '@/data/observable'
import type { ProjectRepository } from '@/data/types'

export function createDexieProjectRepository(db: PMDatabase): ProjectRepository {
  return {
    all: () => db.projects.toArray(),
    get: (id) => db.projects.get(id),
    liveAll: () => fromLiveQuery(() => db.projects.toArray()),
    create: (p: Project) => db.projects.add(p).then(() => undefined),
    update: (id, changes) => db.projects.update(id, changes).then(() => undefined),
    delete: (id) => db.projects.delete(id),
    allocateKey: (projectId: string) =>
      db.transaction('rw', db.projects, async () => {
        const p = await db.projects.get(projectId)
        const n = p?.nextKeyNum ?? 100001
        await db.projects.update(projectId, { nextKeyNum: n + 1 })
        return n
      }),
  }
}
