import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { CommentRepository, CreateCommentInput } from '@/data/types'
import { notifyComment } from './notify-write'

export function createDexieCommentRepository(db: PMDatabase): CommentRepository {
  return {
    liveByIssue: (issueId: string) =>
      fromLiveQuery(() =>
        db.comments
          .where('[issueId+createdAt]')
          .between([issueId, Dexie.minKey], [issueId, Dexie.maxKey])
          .toArray(),
      ),
    // 评论与通知同一事务：评论落库成功即产生通知，不留「有评论没通知」的半截状态。
    // parentId 指向线程根：回复"回复"时自动归并到同一线程根，保持一级嵌套
    add: (input: CreateCommentInput) =>
      db
        .transaction('rw', db.comments, db.issues, db.members, db.notifications, async () => {
          let parentId: string | null = null
          if (input.parentId) {
            const parent = await db.comments.get(input.parentId)
            if (!parent || parent.issueId !== input.issueId) {
              throw new Error('parent comment not found')
            }
            parentId = parent.parentId || parent.id
          }
          await db.comments.add({
            id: nanoid(),
            issueId: input.issueId,
            authorId: input.authorId,
            body: input.body,
            parentId,
            createdAt: Date.now(),
          })
          await notifyComment(db, {
            issueId: input.issueId,
            actorId: input.authorId,
            body: input.body,
          })
        })
        .then(() => undefined),
    update: (id, body) => db.comments.update(id, { body }).then(() => undefined),
    // 删除评论级联删除其回复（一级线程：回复的 parentId 都指向根）
    delete: (id) =>
      db
        .transaction('rw', db.comments, async () => {
          await db.comments.where('parentId').equals(id).delete()
          await db.comments.delete(id)
        })
        .then(() => undefined),
  }
}
