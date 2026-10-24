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
    if (!p) throw new Error('project not found')
    const n = p.nextKeyNum ?? 100001
    await db.projects.update(projectId, { nextKeyNum: n + 1 })
    return { keyNum: n, projectKey: p.key }
  })
}

export function createDexieProjectRepository(db: PMDatabase): ProjectRepository {
  return {
    all: () => db.projects.toArray(),
    get: (id) => db.projects.get(id),
    liveAll: () => fromLiveQuery(() => db.projects.toArray()),
    create: async (p: Project) => {
      await db.transaction('rw', db.projects, async () => {
        const dup = await db.projects.where('key').equals(p.key).count()
        if (dup > 0) throw new Error('project key exists')
        await db.projects.add(p)
      })
    },
    update: async (id, changes) => {
      await db.transaction('rw', db.projects, async () => {
        if (changes.key) {
          const dup = await db.projects.where('key').equals(changes.key).count()
          const current = await db.projects.get(id)
          if (dup > 0 && current?.key !== changes.key) throw new Error('project key exists')
        }
        await db.projects.update(id, changes)
      })
    },
    delete: (id) =>
      db.transaction(
        'rw',
        db.projects,
        db.issues,
        db.projectMembers,
        db.projectRoles,
        db.cycles,
        async () => {
          const count = await db.issues.where('projectId').equals(id).count()
          if (count > 0) throw new Error('project has issues')
          await db.projectMembers.where('projectId').equals(id).delete()
          await db.projectRoles.where('projectId').equals(id).delete()
          await db.cycles.where('projectId').equals(id).delete()
          await db.projects.delete(id)
        },
      ),
    allocateKey: (projectId: string) =>
      allocateProjectKey(db, projectId).then(({ keyNum }) => keyNum),
  }
}
