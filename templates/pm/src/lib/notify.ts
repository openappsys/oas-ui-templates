import type { IssueStatus, Member, NotificationType } from '@/types'

/** 通知写入草稿：id/createdAt/readAt 由数据层补齐，规则层只管「发给谁、为什么」 */
export interface NotificationDraft {
  memberId: string
  type: NotificationType
  issueId?: string
  actorId?: string
  /** 按 type 解释：mention/comment 存正文摘要，status 存新状态码，cycle 存周期名 */
  message?: string
}

/** 通知列表上限：面板只展示最近 50 条（超过部分作为历史，不做分页） */
export const NOTIFICATION_LIMIT = 50

/** 面板只展示两行预览，长评论按 120 字截断 */
const SNIPPET_MAX = 120

const NAME_CHAR = /[\u4e00-\u9fa5A-Za-z0-9_]/

export function snippet(body: string): string {
  const text = body.replace(/\s+/g, ' ').trim()
  return text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX - 1)}…` : text
}

/** 判定 body[index] 处是否为成员名的完整 @提及：
 *  前一个字符不能是名字字符（排除邮箱 a@张伟），后一个字符也不能是（排除 @张伟 命中 @张伟明） */
function mentionsNameAt(body: string, index: number, name: string): boolean {
  const end = index + 1 + name.length
  if (body.slice(index + 1, end) !== name) return false
  if (index > 0 && NAME_CHAR.test(body[index - 1])) return false
  return !NAME_CHAR.test(body[end] ?? '')
}

/** 从评论文本解析被提及的成员 id：按在正文中的出现顺序去重 */
export function mentionedMemberIds(body: string, members: Member[]): string[] {
  const hits: Array<{ index: number; id: string }> = []
  for (const m of members) {
    if (!m.name) continue
    let from = 0
    while (from < body.length) {
      const at = body.indexOf(`@${m.name}`, from)
      if (at < 0) break
      if (mentionsNameAt(body, at, m.name)) hits.push({ index: at, id: m.id })
      from = at + 1
    }
  }
  hits.sort((a, b) => a.index - b.index)
  const out: string[] = []
  for (const hit of hits) if (!out.includes(hit.id)) out.push(hit.id)
  return out
}

/** 评论通知规则：@提及 → mention；否则 Issue 负责人收到 comment；关注者收到 comment。
 *  自己触发的不通知自己；负责人被 @ 时只收 mention，不重复收 comment。 */
export function commentNotificationDrafts(input: {
  issueId: string
  issueAssigneeId: string | null
  actorId: string
  body: string
  members: Member[]
  watchers?: string[]
}): NotificationDraft[] {
  const { issueId, issueAssigneeId, actorId, body, members } = input
  const message = snippet(body)
  const mentioned = mentionedMemberIds(body, members).filter((id) => id !== actorId)
  const drafts: NotificationDraft[] = mentioned.map((memberId) => ({
    memberId,
    type: 'mention',
    issueId,
    actorId,
    message,
  }))
  if (issueAssigneeId && issueAssigneeId !== actorId && !mentioned.includes(issueAssigneeId)) {
    drafts.push({ memberId: issueAssigneeId, type: 'comment', issueId, actorId, message })
  }
  // 关注者：非 actor、未被上面覆盖的都收 comment 通知
  const notified = new Set([actorId, ...mentioned, issueAssigneeId ?? ''])
  for (const w of input.watchers ?? []) {
    if (w !== actorId && !notified.has(w)) {
      drafts.push({ memberId: w, type: 'comment', issueId, actorId, message })
      notified.add(w)
    }
  }
  return drafts
}

const CLOSING_STATUS: IssueStatus[] = ['done', 'cancelled']

/** 字段变更通知规则：指派给新人 → assigned；关闭类状态 → status 给当前负责人；
 *  关注者收到 status 通知。自己触发的不通知自己；解除指派不通知。 */
export function issueChangeNotificationDrafts(input: {
  issueId: string
  actorId: string
  prevAssigneeId: string | null
  nextAssigneeId?: string | null
  prevStatus?: IssueStatus
  nextStatus?: IssueStatus
  watchers?: string[]
}): NotificationDraft[] {
  const { issueId, actorId, prevAssigneeId } = input
  const out: NotificationDraft[] = []
  const nextAssignee = input.nextAssigneeId
  if (nextAssignee && nextAssignee !== prevAssigneeId && nextAssignee !== actorId) {
    out.push({ memberId: nextAssignee, type: 'assigned', issueId, actorId })
  }
  // 同一次变更里改了负责人就按新负责人算，否则沿用旧负责人
  const owner = nextAssignee !== undefined ? nextAssignee : prevAssigneeId
  // 刚把 Issue 指派给他（assigned 已说明一切），不再叠加一条状态通知
  const justAssigned = Boolean(nextAssignee && nextAssignee !== prevAssigneeId)
  const nextStatus = input.nextStatus
  if (
    nextStatus &&
    nextStatus !== input.prevStatus &&
    CLOSING_STATUS.includes(nextStatus) &&
    owner &&
    owner !== actorId &&
    !justAssigned
  ) {
    out.push({ memberId: owner, type: 'status', issueId, actorId, message: nextStatus })
  }
  // 关注者：非 actor、未被上面覆盖的都收 status 通知
  const notified = new Set<string>()
  for (const d of out) notified.add(d.memberId)
  for (const w of input.watchers ?? []) {
    if (w !== actorId && !notified.has(w)) {
      out.push({ memberId: w, type: 'status', issueId, actorId, message: nextStatus ?? '' })
      notified.add(w)
    }
  }
  return out
}
