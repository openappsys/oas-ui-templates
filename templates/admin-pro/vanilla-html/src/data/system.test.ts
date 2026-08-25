import { beforeEach, describe, expect, it } from 'vitest'
import {
  createRole,
  listDepts,
  listMenus,
  listRoles,
  removeRole,
  resetSystem,
  treeDepts,
  treeMenus,
  updateRole,
} from './system'

describe('system 数据源', () => {
  beforeEach(() => resetSystem())

  it('listDepts 返回部门种子快照', async () => {
    const rows = await listDepts()
    expect(rows.length).toBe(6)
    expect(rows[0]).toMatchObject({ name: '总公司', parentId: null })
    expect(rows.some((r) => r.name === '华东区')).toBe(true)
  })

  it('treeDepts 组装「总公司→(技术部/市场部/销售部→(华东区/华南区))」', async () => {
    const tree = await treeDepts()
    expect(tree.length).toBe(1)
    expect(tree[0].name).toBe('总公司')
    expect(tree[0].children.map((c) => c.name)).toEqual(['技术部', '市场部', '销售部'])
    const sales = tree[0].children.find((c) => c.name === '销售部')!
    expect(sales.children.map((c) => c.name)).toEqual(['华东区', '华南区'])
  })

  it('listMenus 返回菜单种子快照且覆盖现有路由', async () => {
    const rows = await listMenus()
    const titles = rows.map((r) => r.title)
    expect(titles).toContain('仪表盘')
    expect(titles).toContain('系统管理')
  })

  it('treeMenus 组装系统管理 M 节点及其子级 C 菜单', async () => {
    const tree = await treeMenus()
    const sys = tree.find((n) => n.title === '系统管理')
    expect(sys?.type).toBe('M')
    expect(sys?.children?.map((c) => c.title)).toEqual([
      '权限管理',
      '角色管理',
      '部门管理',
      '字典管理',
      '日志中心',
    ])
  })

  it('listRoles 返回角色种子快照', async () => {
    const rows = await listRoles()
    expect(rows.length).toBeGreaterThanOrEqual(4)
    expect(rows[0]).toHaveProperty('code')
    expect(rows[0]).toHaveProperty('dataScope')
    expect(rows[0]).toHaveProperty('userCount')
  })

  it('createRole 头插新行并生成 id/created', async () => {
    const before = (await listRoles()).length
    const row = await createRole({
      name: '运营',
      code: 'ops',
      dataScope: 2,
      deptIds: [2, 3],
      userCount: 0,
    })
    expect(row.id).toBeGreaterThan(0)
    expect(row.created).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const after = await listRoles()
    expect(after.length).toBe(before + 1)
    expect(after[0].name).toBe('运营')
  })

  it('updateRole 修改命中行，id 不存在返回 null', async () => {
    const rows = await listRoles()
    const target = rows[rows.length - 1]
    const updated = await updateRole(target.id, { name: '改名' })
    expect(updated?.name).toBe('改名')
    expect(await updateRole(99999, { name: 'x' })).toBeNull()
  })

  it('removeRole 删除命中行，id 不存在返回 false', async () => {
    const rows = await listRoles()
    const before = rows.length
    expect(await removeRole(rows[rows.length - 1].id)).toBe(true)
    expect((await listRoles()).length).toBe(before - 1)
    expect(await removeRole(99999)).toBe(false)
  })
})
