import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'

const first = <T>(o: { subscribe(x: { next(v: T): void }): () => void }): Promise<T> =>
  new Promise((resolve) => {
    const unsub = o.subscribe({
      next: (v: T) => {
        resolve(v)
        unsub()
      },
    })
  })

describe('fromLiveQuery', () => {
  it('推送初值', async () => {
    const db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
    expect(await first(fromLiveQuery(() => db.members.count()))).toBe(0)
  })

  it('数据变更后重新推送', async () => {
    const db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
    const seen: number[] = []
    const unsub = fromLiveQuery(() => db.members.count()).subscribe({ next: (v) => seen.push(v) })
    await new Promise((r) => setTimeout(r, 0))
    await db.members.add({
      id: 'm1',
      name: 'a',
      email: 'a@b.c',
      avatarColor: '#000',
      role: 'admin',
    })
    await new Promise((r) => setTimeout(r, 20))
    unsub()
    expect(seen[0]).toBe(0)
    expect(seen[seen.length - 1]).toBe(1)
  })
})
