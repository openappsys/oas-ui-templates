/**
 * 仪表盘数据模块（自 vanilla src/data/dashboard.ts 去 TS 移植，逻辑与种子数据逐字保留）
 */

/** @typedef {'pending' | 'paid' | 'shipping' | 'done' | 'cancelled'} OrderStatus */
/** @typedef {{ status: OrderStatus, value: number }} OrderSlice */
/** @typedef {{ total: number, slices: OrderSlice[] }} OrderBreakdown */
/**
 * @typedef {Object} RecentOrder
 * @property {string} id
 * @property {string} customer
 * @property {number} amount
 * @property {OrderStatus} status
 * @property {number} daysAgo
 */

const TREND = [820, 932, 901, 1290, 1330, 1520, 1680]

const ORDER_MIX = {
  7: { total: 1926, mix: [0.42, 0.31, 0.18, 0.09] },
  14: { total: 3417, mix: [0.43, 0.3, 0.18, 0.09] },
  30: { total: 6208, mix: [0.45, 0.28, 0.17, 0.1] },
}

const STATUS_ORDER = ['done', 'shipping', 'pending', 'cancelled']

/** @type {RecentOrder[]} */
const RECENT_CATALOG = [
  { id: 'SO-10086', customer: '华信科技', amount: 12800, status: 'done', daysAgo: 0 },
  { id: 'SO-10085', customer: '蓝海贸易', amount: 8600, status: 'shipping', daysAgo: 1 },
  { id: 'SO-10084', customer: '星野文化', amount: 3200, status: 'pending', daysAgo: 2 },
  { id: 'SO-10083', customer: '晨光实业', amount: 21500, status: 'done', daysAgo: 3 },
  { id: 'SO-10082', customer: '云图软件', amount: 6900, status: 'cancelled', daysAgo: 5 },
  { id: 'SO-10081', customer: '远帆教育', amount: 4500, status: 'pending', daysAgo: 9 },
  { id: 'SO-10080', customer: '基石建筑', amount: 9800, status: 'shipping', daysAgo: 12 },
  { id: 'SO-10079', customer: '微澜传媒', amount: 15600, status: 'cancelled', daysAgo: 16 },
  { id: 'SO-10078', customer: '青禾餐饮', amount: 3200, status: 'done', daysAgo: 20 },
  { id: 'SO-10077', customer: '启睿咨询', amount: 7600, status: 'shipping', daysAgo: 24 },
  { id: 'SO-10076', customer: '拓界物流', amount: 18200, status: 'done', daysAgo: 28 },
  { id: 'SO-10075', customer: '静水深流', amount: 1100, status: 'pending', daysAgo: 33 },
]

/**
 * 近 N 天访问趋势序列（周期基线 + 正弦波动）
 * @param {number} days
 * @returns {number[]}
 */
export function trendSeries(days) {
  return Array.from({ length: days }, (_, i) => {
    const base = TREND[i % TREND.length]
    const wave = Math.sin(i * 1.3 + 1) * 60
    return Math.max(200, Math.round(base + wave))
  })
}

/**
 * 近 N 天横轴刻度（>20 天时抽稀：仅保留 1 号、末号与 5 的倍数）
 * @param {number} days
 * @returns {Array<number | ''>}
 */
export function trendDays(days) {
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1
    if (days > 20 && day !== 1 && day !== days && day % 5 !== 0) return ''
    return day
  })
}

/**
 * 订单构成（按天数的总量与状态占比）
 * @param {number} days
 * @returns {OrderBreakdown}
 */
export function orderBreakdown(days) {
  const conf = ORDER_MIX[days] ?? ORDER_MIX[30]
  const values = conf.mix.map((p) => Math.round(conf.total * p))
  values[values.length - 1] = conf.total - values.slice(0, -1).reduce((a, b) => a + b, 0)
  return {
    total: conf.total,
    slices: STATUS_ORDER.map((status, i) => ({ status, value: values[i] })),
  }
}

/**
 * 最近订单（按天数过滤）
 * @param {number} days
 * @returns {RecentOrder[]}
 */
export function recentOrders(days) {
  return RECENT_CATALOG.filter((o) => o.daysAgo < days)
}
