import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { CommentRepository, CreateCommentInput } from '@/data/types'

export function createDexieCommentRepository(db: PMDatabase): CommentRepository {
  return {
    liveByIssue: (issueId: string) =>
      fromLiveQuery(() =>
        db.comments
          .where('[issueId+createdAt]')
          .between([issueId, Dexie.minKey], [issueId, Dexie.maxKey])
          .toArray(),
      ),
    add: (input: CreateCommentInput) =>
      db.comments
        .add({
          id: nanoid(),
          issueId: input.issueId,
          authorId: input.authorId,
          body: input.body,
          createdAt: Date.now(),
        })
        .then(() => undefined),
    update: (id, body) => db.comments.update(id, { body }).then(() => undefined),
    delete: (id) => db.comments.delete(id),
  }
}
