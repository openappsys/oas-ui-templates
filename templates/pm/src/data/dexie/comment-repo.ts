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
    // parentId 存直接父评论（真实树）；无嵌套/一级/无限嵌套只是三种渲染模式
    add: (input: CreateCommentInput) =>
      db
        .transaction('rw', db.comments, db.issues, db.members, db.notifications, async () => {
          let parentId: string | null = null
          if (input.parentId) {
            const parent = await db.comments.get(input.parentId)
            if (!parent || parent.issueId !== input.issueId) {
              throw new Error('parent comment not found')
            }
            parentId = parent.id
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
    // 删除评论级联删除整棵子树（无限嵌套下的后代一并删除）
    delete: (id) =>
      db
        .transaction('rw', db.comments, async () => {
          const doomed: string[] = [id]
          const walk = async (pid: string) => {
            const kids = await db.comments.where('parentId').equals(pid).toArray()
            for (const k of kids) {
              doomed.push(k.id)
              await walk(k.id)
            }
          }
          await walk(id)
          await db.comments.bulkDelete(doomed)
        })
        .then(() => undefined),
  }
}
