import type { OrderStatus } from './orders'

export interface OrderSlice {
  status: OrderStatus
  value: number
}

export interface OrderBreakdown {
  total: number
  slices: OrderSlice[]
}

export interface RecentOrder {
  id: string
  customer: string
  amount: number
  status: OrderStatus
  daysAgo: number
}

const TREND = [820, 932, 901, 1290, 1330, 1520, 1680]

const ORDER_MIX: Record<number, { total: number; mix: number[] }> = {
  7: { total: 1926, mix: [0.42, 0.31, 0.18, 0.09] },
  14: { total: 3417, mix: [0.43, 0.3, 0.18, 0.09] },
  30: { total: 6208, mix: [0.45, 0.28, 0.17, 0.1] },
}

const STATUS_ORDER: OrderStatus[] = ['done', 'shipping', 'pending', 'cancelled']

const RECENT_CATALOG: RecentOrder[] = [
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

export function trendSeries(days: number): number[] {
  return Array.from({ length: days }, (_, i) => {
    const base = TREND[i % TREND.length]
    const wave = Math.sin(i * 1.3 + 1) * 60
    return Math.max(200, Math.round(base + wave))
  })
}

export function trendDays(days: number): Array<number | ''> {
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1
    if (days > 20 && day !== 1 && day !== days && day % 5 !== 0) return ''
    return day
  })
}

export function orderBreakdown(days: number): OrderBreakdown {
  const conf = ORDER_MIX[days] ?? ORDER_MIX[30]
  const values = conf.mix.map((p) => Math.round(conf.total * p))
  values[values.length - 1] = conf.total - values.slice(0, -1).reduce((a, b) => a + b, 0)
  return {
    total: conf.total,
    slices: STATUS_ORDER.map((status, i) => ({ status, value: values[i] })),
  }
}

export function recentOrders(days: number): RecentOrder[] {
  return RECENT_CATALOG.filter((o) => o.daysAgo < days)
}
