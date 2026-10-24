import type { PMDatabase } from '@/db/schema'
import type { Project } from '@/types'
import { fromLiveQuery } from '@/data/observable'
import type { ProjectRepository } from '@/data/types'

export function allocateProjectKey(
  db: PMDatabase,
  projectId: string,
): Promise<{ keyNum: number; projectKey: string }> {
  return db.transaction('rw', db.projects, async () => {
    const p = await db.projects.get(projectId)
    const n = p?.nextKeyNum ?? 100001
    await db.projects.update(projectId, { nextKeyNum: n + 1 })
    return { keyNum: n, projectKey: p?.key ?? 'OAS' }
  })
}

export function createDexieProjectRepository(db: PMDatabase): ProjectRepository {
  return {
    all: () => db.projects.toArray(),
    get: (id) => db.projects.get(id),
    liveAll: () => fromLiveQuery(() => db.projects.toArray()),
    create: (p: Project) => db.projects.add(p).then(() => undefined),
    update: (id, changes) => db.projects.update(id, changes).then(() => undefined),
    delete: (id) =>
      db.transaction('rw', db.projects, db.issues, db.projectMembers, db.projectRoles, async () => {
        const count = await db.issues.where('projectId').equals(id).count()
        if (count > 0) throw new Error('project has issues')
        await db.projectMembers.where('projectId').equals(id).delete()
        await db.projectRoles.where('projectId').equals(id).delete()
        await db.projects.delete(id)
      }),
    allocateKey: (projectId: string) =>
      allocateProjectKey(db, projectId).then(({ keyNum }) => keyNum),
  }
}
