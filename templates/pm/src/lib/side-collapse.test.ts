import { describe, expect, it } from 'vitest'
import {
  isGroupCollapsed,
  loadCollapsedGroups,
  storeCollapsedGroups,
  toggleCollapsedGroup,
} from './side-collapse'

/** 内存版 Storage：只实现读写两个通道 */
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
  }
}

describe('侧栏分组折叠偏好', () => {
  it('缺省全部展开：没有键时返回空数组', () => {
    expect(loadCollapsedGroups(memoryStorage())).toEqual([])
  })

  it('读回写入的折叠键', () => {
    const storage = memoryStorage()
    storeCollapsedGroups(['status', 'cycles'], storage)
    expect(loadCollapsedGroups(storage)).toEqual(['status', 'cycles'])
  })

  it('损坏的 JSON / 非字符串数组回落全展开，不抛错', () => {
    expect(loadCollapsedGroups(memoryStorage({ 'oas-pm-side-collapsed': '{' }))).toEqual([])
    expect(loadCollapsedGroups(memoryStorage({ 'oas-pm-side-collapsed': '"status"' }))).toEqual([])
    expect(
      loadCollapsedGroups(memoryStorage({ 'oas-pm-side-collapsed': '[1, "", "priority"]' })),
    ).toEqual(['priority'])
  })

  it('切换：折叠则追加、再次切换则移除', () => {
    expect(toggleCollapsedGroup([], 'status')).toEqual(['status'])
    expect(toggleCollapsedGroup(['status'], 'priority')).toEqual(['status', 'priority'])
    expect(toggleCollapsedGroup(['status', 'priority'], 'status')).toEqual(['priority'])
  })

  it('查询折叠态', () => {
    expect(isGroupCollapsed(['status'], 'status')).toBe(true)
    expect(isGroupCollapsed(['status'], 'priority')).toBe(false)
  })

  it('切换不修改入参', () => {
    const input = ['status']
    toggleCollapsedGroup(input, 'priority')
    expect(input).toEqual(['status'])
  })
})
