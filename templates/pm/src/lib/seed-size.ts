/**
 * 播种规模：产品/门户默认 2 万条（首启秒级，开发与模板网站体验优先）；
 * 测试可调——e2e 常规 5K，M1 架构用例显式 10 万（压力口径）。
 *
 * 为什么可配：每个 e2e 用例都是全新浏览器上下文，都要重播一遍种子——10 万条实测单次
 * 44–134s（随负载波动），超过用例预算就出现轮换式的 seed 超时。断言只依赖相对量，
 * 5K 足够覆盖筛选/排序/虚拟列表语义。
 */
export const SEED_SIZE_KEY = 'oas-pm-seed-size'

/** 产品/门户默认规模（首启体验优先） */
export const DEFAULT_SEED_SIZE = 20_000

/** 下限：再少侧栏筛选/日程/迭代分组会没有样本可断言 */
export const MIN_SEED_SIZE = 1_000

/** 上限：压测/架构验收口径（M1 用例用 10 万） */
export const MAX_SEED_SIZE = 100_000

/** 原始 localStorage 值 → 实际播种条数；空/非法回落默认，越界夹取 */
export function parseSeedSize(raw: string | null): number {
  if (raw === null || raw.trim() === '') return DEFAULT_SEED_SIZE
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_SEED_SIZE
  return Math.min(MAX_SEED_SIZE, Math.max(MIN_SEED_SIZE, Math.round(n)))
}
