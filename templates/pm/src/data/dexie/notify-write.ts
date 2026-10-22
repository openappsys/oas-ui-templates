import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import type { IssueStatus } from '@/types'
import {
  commentNotificationDrafts,
  issueChangeNotificationDrafts,
  type NotificationDraft,
} from '@/lib/notify'

/** 同一批草稿共享基准时间，+i 让插入顺序稳定（面板按 createdAt 倒序，同批不会因 id 随机而乱序） */
export async function insertNotificationDrafts(
  db: PMDatabase,
  drafts: NotificationDraft[],
): Promise<void> {
  if (drafts.length === 0) return
  const now = Date.now()
  await db.notifications.bulkAdd(
    drafts.map((draft, index) => ({
      id: nanoid(),
      readAt: null,
      createdAt: now + index,
      ...draft,
    })),
  )
}

/** 评论写入后：@提及 → mention，否则负责人收 comment（与 mock 服务端同点触发） */
export async function notifyComment(
  db: PMDatabase,
  input: { issueId: string; actorId: string; body: string },
): Promise<void> {
  const issue = await db.issues.get(input.issueId)
  if (!issue) return
  const members = await db.members.toArray()
  await insertNotificationDrafts(
    db,
    commentNotificationDrafts({ ...input, issueAssigneeId: issue.assigneeId, members }),
  )
}

/** 活动日志写入后：指派/关闭类状态变更 → 通知（活动先于字段更新落库，因此读到的是变更前的 Issue）。
 *  指派的活动 type 有两个来源：详情抽屉按字段名写 'assigneeId'，批量通道写语义名 'assignee'，都认 */
export async function notifyActivity(
  db: PMDatabase,
  entry: { issueId: string; actorId: string; type: string; to?: string },
): Promise<void> {
  const isAssignee = entry.type === 'assignee' || entry.type === 'assigneeId'
  if (entry.type !== 'status' && !isAssignee) return
  const issue = await db.issues.get(entry.issueId)
  if (!issue) return
  const drafts = isAssignee
    ? issueChangeNotificationDrafts({
        issueId: entry.issueId,
        actorId: entry.actorId,
        prevAssigneeId: issue.assigneeId,
        nextAssigneeId: entry.to ? entry.to : null,
      })
    : issueChangeNotificationDrafts({
        issueId: entry.issueId,
        actorId: entry.actorId,
        prevAssigneeId: issue.assigneeId,
        prevStatus: issue.status,
        nextStatus: entry.to as IssueStatus | undefined,
      })
  await insertNotificationDrafts(db, drafts)
}
