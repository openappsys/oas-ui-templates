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
    // 评论与通知同一事务：评论落库成功即产生通知，不留「有评论没通知」的半截状态
    add: (input: CreateCommentInput) =>
      db
        .transaction('rw', db.comments, db.issues, db.members, db.notifications, async () => {
          await db.comments.add({
            id: nanoid(),
            issueId: input.issueId,
            authorId: input.authorId,
            body: input.body,
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
    delete: (id) => db.comments.delete(id),
  }
}
