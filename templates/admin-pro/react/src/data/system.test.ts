import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDept,
  createDictItem,
  createDictType,
  createRole,
  listDepts,
  listDictItems,
  listDictTypes,
  listMenus,
  listRoles,
  removeDept,
  removeDictItem,
  removeDictType,
  removeRole,
  resetSystem,
  treeDepts,
  treeMenus,
  updateDept,
  updateDictItem,
  updateDictType,
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

  it('createDept 生成新 id 并头插/尾插到树', async () => {
    const before = (await listDepts()).length
    const row = await createDept({ name: '华东大区', parentId: 1, members: 0 })
    expect(row.id).toBeGreaterThan(0)
    expect((await listDepts()).length).toBe(before + 1)
    const tree = await treeDepts()
    const root = tree.find((n) => n.id === 1)!
    expect(root.children.some((c) => c.name === '华东大区')).toBe(true)
  })

  it('updateDept 修改命中行，id 不存在返回 null', async () => {
    const updated = await updateDept(2, { name: '研发部' })
    expect(updated?.name).toBe('研发部')
    expect(await updateDept(99999, { name: 'x' })).toBeNull()
  })

  it('removeDept 删除命中行，id 不存在返回 false', async () => {
    const before = (await listDepts()).length
    expect(await removeDept(6)).toBe(true)
    expect((await listDepts()).length).toBe(before - 1)
    expect(await removeDept(99999)).toBe(false)
  })

  it('listDictTypes 返回订单状态种子', async () => {
    const rows = await listDictTypes()
    expect(rows.length).toBe(1)
    expect(rows[0]).toMatchObject({ name: '订单状态', code: 'order_status' })
  })

  it('listDictItems 按类型返回键值项且匹配订单状态', async () => {
    const items = await listDictItems(1)
    expect(items).toHaveLength(5)
    expect(items[0]).toMatchObject({ label: '待支付', value: 'pending', sort: 1 })
    expect(items[4]).toMatchObject({ label: '已取消', value: 'cancelled', sort: 5 })
  })

  it('createDictType 追加新行并生成 id', async () => {
    const before = (await listDictTypes()).length
    const row = await createDictType({ name: '订单来源', code: 'order_source' })
    expect(row.id).toBeGreaterThan(0)
    expect((await listDictTypes()).length).toBe(before + 1)
    expect((await listDictTypes()).some((t) => t.name === '订单来源')).toBe(true)
  })

  it('updateDictType 修改命中行，id 不存在返回 null', async () => {
    const updated = await updateDictType(1, { name: '订单类目' })
    expect(updated?.name).toBe('订单类目')
    expect(await updateDictType(99999, { name: 'x' })).toBeNull()
  })

  it('removeDictType 删除命中行及其键值项', async () => {
    const beforeTypes = (await listDictTypes()).length
    const beforeItems = (await listDictItems(1)).length
    expect(await removeDictType(1)).toBe(true)
    expect((await listDictTypes()).length).toBe(beforeTypes - 1)
    expect((await listDictItems(1)).length).toBe(0)
    expect(beforeItems).toBe(5)
    expect(await removeDictType(99999)).toBe(false)
  })

  it('createDictItem 追加键值项，update/remove 各自生效', async () => {
    const item = await createDictItem({ typeId: 1, label: '退款中', value: 'refunding', sort: 6 })
    expect(item.id).toBeGreaterThan(0)
    expect((await listDictItems(1)).some((d) => d.value === 'refunding')).toBe(true)
    const updated = await updateDictItem(item.id, { label: '退款处理中' })
    expect(updated?.label).toBe('退款处理中')
    expect(await removeDictItem(item.id)).toBe(true)
    expect((await listDictItems(1)).some((d) => d.value === 'refunding')).toBe(false)
    expect(await updateDictItem(99999, { label: 'x' })).toBeNull()
    expect(await removeDictItem(99999)).toBe(false)
  })
})
