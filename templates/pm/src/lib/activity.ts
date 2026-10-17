import { nanoid } from 'nanoid'
import { db } from '@/db/schema'

/** 活动记录：字段级 diff 落库（type=字段名，from→to） */
export async function logActivity(
  issueId: string,
  actorId: string,
  type: string,
  extra?: { field?: string; from?: string; to?: string },
): Promise<void> {
  await db.activities.add({
    id: nanoid(),
    issueId,
    actorId,
    type,
    ...extra,
    createdAt: Date.now(),
  })
}
