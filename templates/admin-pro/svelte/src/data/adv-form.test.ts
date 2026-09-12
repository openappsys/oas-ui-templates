import { describe, expect, it } from 'vitest'
import { advFormData } from './adv-form'

describe('adv-form 数据源', () => {
  it('返回电话/地区/树形地区三组数据', () => {
    const d = advFormData()
    expect(d.phones).toHaveLength(3)
    expect(d.regions).toHaveLength(2)
    expect(d.treeRegions).toHaveLength(2)
  })

  it('电话为静态区号（数据，非文案）', () => {
    const d = advFormData()
    expect(d.phones[0]!.label).toBe('010-88886666')
    expect(d.phones.map((p) => p.value)).toEqual(['010-88886666', '021-66668888', '0755-33335555'])
  })

  it('地区为嵌套树（省份→城市）', () => {
    const d = advFormData()
    expect(d.regions[0]).toMatchObject({ label: '浙江', value: 'zj' })
    expect(d.regions[0]!.children?.map((c) => c.value)).toEqual(['hz', 'nb'])
  })

  it('确定性：重复调用数据一致且深拷贝（修改不污染源）', () => {
    const a = advFormData()
    const b = advFormData()
    expect(a).toEqual(b)
    expect(a.regions).not.toBe(b.regions)
    a.regions[0]!.label = '已改'
    expect(advFormData().regions[0]!.label).toBe('浙江')
  })
})
