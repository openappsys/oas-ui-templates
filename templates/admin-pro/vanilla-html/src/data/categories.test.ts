import { beforeEach, describe, expect, it } from 'vitest'
import {
  createCategory,
  listCategories,
  removeCategory,
  resetCategories,
  updateCategory,
} from './categories'
import type { CategoryRow } from './categories'

beforeEach(() => {
  localStorage.clear()
  resetCategories()
})

describe('categories 数据源', () => {
  it('listCategories 返回种子分类', async () => {
    const rows = await listCategories()
    expect(rows.length).toBe(4)
    expect(rows[0]).toMatchObject({ name: '数码', code: 'digital', sort: 1 })
  })

  it('createCategory 追加新行并生成 id', async () => {
    const before = (await listCategories()).length
    const row = await createCategory({
      name: '图书',
      code: 'book',
      sort: 5,
      status: 'on',
      desc: '',
    })
    expect(row.id).toBeGreaterThan(0)
    expect((await listCategories()).length).toBe(before + 1)
    expect((await listCategories()).some((r) => r.name === '图书')).toBe(true)
  })

  it('updateCategory 更新命中行', async () => {
    const row = (await listCategories())[0] as CategoryRow
    const updated = await updateCategory(row.id, { name: '数码家电' })
    expect(updated?.name).toBe('数码家电')
  })

  it('removeCategory 删除命中行，id 不存在返回 false', async () => {
    const before = (await listCategories()).length
    const row = (await listCategories())[0] as CategoryRow
    expect(await removeCategory(row.id)).toBe(true)
    expect((await listCategories()).length).toBe(before - 1)
    expect(await removeCategory(99999)).toBe(false)
  })
})
