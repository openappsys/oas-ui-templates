import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED_SIZE, MAX_SEED_SIZE, MIN_SEED_SIZE, parseSeedSize } from './seed-size'

describe('parseSeedSize', () => {
  it('缺省（未设置）取产品默认 10 万', () => {
    expect(parseSeedSize(null)).toBe(DEFAULT_SEED_SIZE)
    expect(DEFAULT_SEED_SIZE).toBe(100_000)
  })

  it('空串/空白按未设置处理，不落成 0', () => {
    expect(parseSeedSize('')).toBe(DEFAULT_SEED_SIZE)
    expect(parseSeedSize('   ')).toBe(DEFAULT_SEED_SIZE)
  })

  it('合法数字原样采纳（e2e 用 5000）', () => {
    expect(parseSeedSize('5000')).toBe(5_000)
  })

  it('夹取到 [1000, 100000]：过小无数据可筛，过大只会拖慢首屏', () => {
    expect(parseSeedSize('10')).toBe(MIN_SEED_SIZE)
    expect(parseSeedSize('999999')).toBe(MAX_SEED_SIZE)
    expect(parseSeedSize('-1')).toBe(MIN_SEED_SIZE)
  })

  it('非法输入回落到默认值', () => {
    expect(parseSeedSize('abc')).toBe(DEFAULT_SEED_SIZE)
    expect(parseSeedSize('NaN')).toBe(DEFAULT_SEED_SIZE)
  })
})
