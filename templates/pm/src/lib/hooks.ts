import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { ISSUE_STATUSES } from '@/types'

/** 全项目真实计数（index count，与窗口无关） */
export function useProjectCounts(projectId: string) {
  return useLiveQuery(async () => {
    const [total, ...byStatus] = await Promise.all([
      db.issues.where('projectId').equals(projectId).count(),
      ...ISSUE_STATUSES.map((s) =>
        db.issues.where('[projectId+status]').equals([projectId, s]).count(),
      ),
    ])
    return {
      total,
      byStatus: Object.fromEntries(ISSUE_STATUSES.map((s, i) => [s, byStatus[i]])),
    }
  }, [projectId])
}
