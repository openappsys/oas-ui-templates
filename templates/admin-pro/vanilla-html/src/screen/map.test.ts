import { describe, expect, it } from 'vitest'
import { pickVisibleLabels, tweenSteps, type LabelBox } from './map'

const box = (key: string, x: number, y: number, w = 60, h = 16): LabelBox => ({
  key,
  x,
  y,
  w,
  h,
})

describe('pickVisibleLabels（按输入序为优先级）', () => {
  it('无重叠 → 全部保留', () => {
    const items = [box('a', 0, 0), box('b', 300, 0), box('c', 0, 300)]
    expect(pickVisibleLabels(items)).toEqual(new Set(['a', 'b', 'c']))
  })

  it('两标签重叠 → 保留先出现（高优先级）者', () => {
    const items = [box('a', 0, 0), box('b', 20, 0)]
    expect(pickVisibleLabels(items)).toEqual(new Set(['a']))
    // 输入序即优先级：交换顺序后保留另一个
    expect(pickVisibleLabels([box('b', 20, 0), box('a', 0, 0)])).toEqual(new Set(['b']))
  })

  it('链式：1 压 2、2 压 3、1 不压 3 → 保留 1 和 3', () => {
    // 半宽 30 + 默认 pad 4 → 扩展半径 34；间距 60 时 1∩2、2∩3 均相交，1∩3 不相交
    const items = [box('1', 0, 0), box('2', 60, 0), box('3', 120, 0)]
    expect(pickVisibleLabels(items)).toEqual(new Set(['1', '3']))
  })

  it('pad 生效：边缘相距 8px、半宽 30 的两标签，pad=4 时隐藏后者，pad=2 时两者可见', () => {
    // 原始矩形边缘相距 8px（圆心距 68）；扩展后 pad=4 时恰好相接（判相交），
    // pad=2 时仍留 4px 间隙
    const items = [box('a', 0, 0), box('b', 68, 0)]
    expect(pickVisibleLabels(items, 4)).toEqual(new Set(['a']))
    expect(pickVisibleLabels(items, 2)).toEqual(new Set(['a', 'b']))
  })
})

describe('tweenSteps', () => {
  it('长度=steps、末值精确=to、线性中点正确', () => {
    const seq = tweenSteps(0, 100, 10)
    expect(seq).toHaveLength(10)
    expect(seq[9]).toBe(100)
    expect(seq).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
  })

  it('from>to 反向递减同样成立', () => {
    const seq = tweenSteps(100, 0, 10)
    expect(seq).toHaveLength(10)
    expect(seq[9]).toBe(0)
    expect(seq).toEqual([90, 80, 70, 60, 50, 40, 30, 20, 10, 0])
  })
})
