/**
 * 播种规模：产品默认 10 万条演示数据；e2e 通过 localStorage 调小。
 *
 * 为什么可配：每个 e2e 用例都是全新浏览器上下文，都要重播一遍种子——10 万条实测单次
 * 44–134s（随负载波动），超过用例预算就出现轮换式的 seed 超时。断言只依赖相对量，
 * 5K 足够覆盖筛选/排序/虚拟列表语义。
 */
export const SEED_SIZE_KEY = 'oas-pm-seed-size'

/** 产品/门户默认规模（保持不变） */
export const DEFAULT_SEED_SIZE = 100_000

/** 下限：再少侧栏筛选/日程/迭代分组会没有样本可断言 */
export const MIN_SEED_SIZE = 1_000

/** 上限与产品默认一致：演示数据没必要更大，只会拖慢首屏 */
export const MAX_SEED_SIZE = DEFAULT_SEED_SIZE

/** 原始 localStorage 值 → 实际播种条数；空/非法回落默认，越界夹取 */
export function parseSeedSize(raw: string | null): number {
  if (raw === null || raw.trim() === '') return DEFAULT_SEED_SIZE
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_SEED_SIZE
  return Math.min(MAX_SEED_SIZE, Math.max(MIN_SEED_SIZE, Math.round(n)))
}
