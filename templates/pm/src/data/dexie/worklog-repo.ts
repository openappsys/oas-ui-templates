import { nanoid } from 'nanoid'
import type { WorklogRepository } from '@/data/types'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'

export function createDexieWorklogRepository(db: PMDatabase): WorklogRepository {
  return {
    liveByIssue(issueId) {
      return fromLiveQuery(() =>
        db.worklogs
          .where('[issueId+createdAt]')
          .between([issueId, 0], [issueId, Number.MAX_SAFE_INTEGER])
          .reverse()
          .toArray(),
      )
    },
    async add(input) {
      await db.worklogs.add({ id: nanoid(), createdAt: Date.now(), ...input })
    },
    async remove(id) {
      await db.worklogs.delete(id)
    },
    liveMemberMinutes(projectId) {
      void projectId
      return fromLiveQuery(async () => {
        const logs = await db.worklogs.toArray()
        const byMember = new Map<string, number>()
        for (const l of logs) byMember.set(l.memberId, (byMember.get(l.memberId) ?? 0) + l.minutes)
        return [...byMember.entries()].map(([memberId, minutes]) => ({ memberId, minutes }))
      })
    },
  }
}
