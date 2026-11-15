import { describe, expect, it } from 'vitest'
import { reconcileRank } from './screen'
import type { CountrySales } from '../data/screen'

const c = (key: string, value: number): CountrySales => ({
  key,
  name: key,
  iso3: key.toUpperCase(),
  lng: 0,
  lat: 0,
  value,
})
// fmtValue 走回调（生产里是 locale 紧凑格式化），测试里直接透传便于断言
const fmt = (v: number): string => `¥${v}`

// 初始榜单：a(100) > b(60) > c(30)，结构与 rankHtml 输出一致
const seed = (): HTMLElement => {
  const list = document.createElement('div')
  list.innerHTML = `
    <div class="rank-item" data-country="a"><span class="rank-no rank-no-1">1</span><span class="rank-name">a</span><div class="rank-bar"><i style="width:100%"></i></div><span class="rank-val">¥100</span></div>
    <div class="rank-item" data-country="b"><span class="rank-no rank-no-2">2</span><span class="rank-name">b</span><div class="rank-bar"><i style="width:60%"></i></div><span class="rank-val">¥60</span></div>
    <div class="rank-item" data-country="c"><span class="rank-no rank-no-3">3</span><span class="rank-name">c</span><div class="rank-bar"><i style="width:30%"></i></div><span class="rank-val">¥30</span></div>`
  return list
}

const rows = (list: HTMLElement): HTMLElement[] => Array.from(list.querySelectorAll('.rank-item'))

describe('reconcileRank', () => {
  it('在位更新：同序同 key 只更文本与宽度，节点 identity 保留', () => {
    const list = seed()
    const before = rows(list)
    // 值变化但次序不变：b 涨到 80（max 仍 100 → 80%）
    reconcileRank(list, [c('a', 100), c('b', 80), c('c', 30)], fmt)
    const after = rows(list)
    expect(after).toHaveLength(3)
    // 三个节点全部复用，未重建
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    expect(after[2]).toBe(before[2])
    expect(after[1].querySelector('.rank-val')?.textContent).toBe('¥80')
    expect(after[1].querySelector<HTMLElement>('.rank-bar i')?.style.width).toBe('80%')
    expect(after[0].querySelector('.rank-no')?.textContent).toBe('1')
    expect(after[0].classList.contains('rank-item')).toBe(true)
  })

  it('重排：顺序交换 + .rank-no 数位与 rank-no-N class 重写', () => {
    const list = seed()
    const rowA = rows(list)[0]
    const rowB = rows(list)[1]
    // b 涨到 120 超过 a：max 变为 120 → b 100%，a 83%（Math.round(100/120*100)）
    reconcileRank(list, [c('b', 120), c('a', 100), c('c', 30)], fmt)
    const after = rows(list)
    expect(after.map((r) => r.dataset.country)).toEqual(['b', 'a', 'c'])
    // 节点 identity 保留（仅移动，不重建）
    expect(after[0]).toBe(rowB)
    expect(after[1]).toBe(rowA)
    const noB = after[0].querySelector('.rank-no')!
    expect(noB.textContent).toBe('1')
    expect(noB.className).toBe('rank-no rank-no-1')
    const noA = after[1].querySelector('.rank-no')!
    expect(noA.textContent).toBe('2')
    expect(noA.className).toBe('rank-no rank-no-2')
    expect(after[0].querySelector<HTMLElement>('.rank-bar i')?.style.width).toBe('100%')
    expect(after[1].querySelector<HTMLElement>('.rank-bar i')?.style.width).toBe('83%')
    expect(after[1].querySelector('.rank-val')?.textContent).toBe('¥100')
  })

  it('删除：top 变少，多余行移除', () => {
    const list = seed()
    reconcileRank(list, [c('a', 100), c('c', 30)], fmt)
    const after = rows(list)
    expect(after.map((r) => r.dataset.country)).toEqual(['a', 'c'])
    expect(list.querySelector('[data-country="b"]')).toBeNull()
    // 重排后 c 升为第 2：rank-no 重写
    const noC = after[1].querySelector('.rank-no')!
    expect(noC.textContent).toBe('2')
    expect(noC.className).toBe('rank-no rank-no-2')
  })

  it('新增：新进入 top 的行创建并插到正确位次', () => {
    const list = seed()
    // d(90) 插到 a 与 b 之间；max 仍 100 → d 90%
    reconcileRank(list, [c('a', 100), c('d', 90), c('b', 60), c('c', 30)], fmt)
    const after = rows(list)
    expect(after.map((r) => r.dataset.country)).toEqual(['a', 'd', 'b', 'c'])
    const rowD = after[1]
    expect(rowD.querySelector('.rank-name')?.textContent).toBe('d')
    expect(rowD.querySelector('.rank-val')?.textContent).toBe('¥90')
    expect(rowD.querySelector<HTMLElement>('.rank-bar i')?.style.width).toBe('90%')
    const noD = rowD.querySelector('.rank-no')!
    expect(noD.textContent).toBe('2')
    expect(noD.className).toBe('rank-no rank-no-2')
    // 原 b、c 的位次与 class 顺延重写
    expect(after[2].querySelector('.rank-no')?.className).toBe('rank-no rank-no-3')
    expect(after[3].querySelector('.rank-no')?.className).toBe('rank-no rank-no-4')
  })
})
