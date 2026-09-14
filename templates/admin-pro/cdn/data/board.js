/**
 * 数据看板数据模块（自 vanilla src/data/board.ts 去 TS 移植，逻辑与种子数据逐字保留）
 */

/**
 * @typedef {Object} BoardStat
 * @property {'gmv' | 'orders' | 'users' | 'conversion'} key
 * @property {string} value
 * @property {string} [prefix]
 * @property {string} [suffix]
 * @property {boolean} anim
 */
/** @typedef {{ key: string, value: number, name: string }} CategorySlice */
/** @typedef {{ name: string, data: number[] }} ChannelSeries */
/**
 * @typedef {Object} BoardData
 * @property {BoardStat[]} stats
 * @property {number[]} monthRevenue
 * @property {CategorySlice[]} categoryShare
 * @property {{ series: ChannelSeries[] }} channel
 * @property {{ order: number, revenue: number, users: number }} quarterTargets
 */

/** @type {BoardStat[]} */
const STATS = [
  { key: 'gmv', value: '12845678', prefix: '¥', anim: true },
  { key: 'orders', value: '1926', anim: true },
  { key: 'users', value: '328', anim: false },
  { key: 'conversion', value: '4.6', suffix: '%', anim: false },
]

const MONTH_REVENUE = [86, 92, 65, 78, 88, 96]

/** @type {CategorySlice[]} */
const CATEGORY_SHARE = [
  { key: 'digital', value: 40, name: '数码' },
  { key: 'appliance', value: 35, name: '家电' },
  { key: 'food', value: 25, name: '食品' },
]

/** @type {ChannelSeries[]} */
const CHANNEL_SERIES = [
  { name: '线上', data: [320, 302, 341, 374] },
  { name: '分销', data: [120, 132, 101, 134] },
  { name: '门店', data: [220, 182, 191, 234] },
]

/** @returns {BoardData} */
export function boardData() {
  return {
    stats: STATS.map((s) => ({ ...s })),
    monthRevenue: [...MONTH_REVENUE],
    categoryShare: CATEGORY_SHARE.map((c) => ({ ...c })),
    channel: { series: CHANNEL_SERIES.map((s) => ({ ...s, data: [...s.data] })) },
    quarterTargets: { order: 72, revenue: 58, users: 85 },
  }
}
