import { describe, expect, it } from 'vitest'
import { selectionState, toggleAll } from './selection'

const IDS = ['a', 'b', 'c']

describe('表头全选', () => {
  it('三态：无选中 / 部分 / 全部', () => {
    expect(selectionState(IDS, new Set())).toBe('none')
    expect(selectionState(IDS, new Set(['b']))).toBe('partial')
    expect(selectionState(IDS, new Set(IDS))).toBe('all')
  })

  it('空列表视作无选中（表头勾选框不显示 indeterminate）', () => {
    expect(selectionState([], new Set())).toBe('none')
  })

  it('窗口外的既有选择不影响三态判定（只看这批 id）', () => {
    expect(selectionState(IDS, new Set(['a', 'b', 'c', 'z']))).toBe('all')
    expect(selectionState(IDS, new Set(['z']))).toBe('none')
  })

  it('全选：把缺失的 id 并入，保留窗口外的选择', () => {
    const next = toggleAll(IDS, new Set(['z']))
    expect([...next].sort()).toEqual(['a', 'b', 'c', 'z'])
  })

  it('已全选：只清掉这批 id，窗口外选择保留', () => {
    const next = toggleAll(IDS, new Set(['a', 'b', 'c', 'z']))
    expect([...next]).toEqual(['z'])
  })

  it('不修改入参', () => {
    const input = new Set(['a'])
    toggleAll(IDS, input)
    expect([...input]).toEqual(['a'])
  })
})
