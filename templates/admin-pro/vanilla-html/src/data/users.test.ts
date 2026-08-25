import { beforeEach, describe, expect, it } from 'vitest'
import { createUser, listUsers, removeUser, resetUsers, updateUser } from './users'

describe('users 数据源', () => {
  beforeEach(() => resetUsers())

  it('listUsers 返回种子数据快照', async () => {
    const rows = await listUsers()
    expect(rows.length).toBeGreaterThanOrEqual(8)
    expect(rows[0]).toHaveProperty('id')
    expect(rows[0]).toHaveProperty('name')
    expect(rows[0]).toHaveProperty('roleId')
  })

  it('种子用户 roleId 关联系统角色', async () => {
    const rows = await listUsers()
    expect(rows.find((r) => r.name === '张伟')?.roleId).toBe(1)
    expect(rows.find((r) => r.name === '李娜')?.roleId).toBe(4)
  })

  it('createUser 头插新行并生成 id/created', async () => {
    const before = (await listUsers()).length
    const row = await createUser({
      name: '新人',
      email: 'new@example.com',
      role: 'editor',
      roleId: 2,
      status: 'active',
    })
    expect(row.id).toBeGreaterThan(0)
    expect(row.roleId).toBe(2)
    expect(row.created).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const after = await listUsers()
    expect(after.length).toBe(before + 1)
    expect(after[0].name).toBe('新人')
    expect(after[0].roleId).toBe(2)
  })

  it('updateUser 修改命中行，id 不存在返回 null', async () => {
    const rows = await listUsers()
    const target = rows[rows.length - 1]
    const updated = await updateUser(target.id, { name: '改名', roleId: 3 })
    expect(updated?.name).toBe('改名')
    expect(updated?.roleId).toBe(3)
    expect(await updateUser(99999, { name: 'x' })).toBeNull()
  })

  it('removeUser 删除命中行，id 不存在返回 false', async () => {
    const rows = await listUsers()
    const before = rows.length
    expect(await removeUser(rows[rows.length - 1].id)).toBe(true)
    expect((await listUsers()).length).toBe(before - 1)
    expect(await removeUser(99999)).toBe(false)
  })
})
