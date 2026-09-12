export interface BoardStat {
  key: 'gmv' | 'orders' | 'users' | 'conversion'
  value: string
  prefix?: string
  suffix?: string
  anim: boolean
}

export interface CategorySlice {
  key: string
  value: number
  name: string
}

export interface ChannelSeries {
  name: string
  data: number[]
}

export interface BoardData {
  stats: BoardStat[]
  monthRevenue: number[]
  categoryShare: CategorySlice[]
  channel: { series: ChannelSeries[] }
  quarterTargets: { order: number; revenue: number; users: number }
}

const STATS: BoardStat[] = [
  { key: 'gmv', value: '12845678', prefix: '¥', anim: true },
  { key: 'orders', value: '1926', anim: true },
  { key: 'users', value: '328', anim: false },
  { key: 'conversion', value: '4.6', suffix: '%', anim: false },
]

const MONTH_REVENUE = [86, 92, 65, 78, 88, 96]

const CATEGORY_SHARE: CategorySlice[] = [
  { key: 'digital', value: 40, name: '数码' },
  { key: 'appliance', value: 35, name: '家电' },
  { key: 'food', value: 25, name: '食品' },
]

const CHANNEL_SERIES: ChannelSeries[] = [
  { name: '线上', data: [320, 302, 341, 374] },
  { name: '分销', data: [120, 132, 101, 134] },
  { name: '门店', data: [220, 182, 191, 234] },
]

export function boardData(): BoardData {
  return {
    stats: STATS.map((s) => ({ ...s })),
    monthRevenue: [...MONTH_REVENUE],
    categoryShare: CATEGORY_SHARE.map((c) => ({ ...c })),
    channel: { series: CHANNEL_SERIES.map((s) => ({ ...s, data: [...s.data] })) },
    quarterTargets: { order: 72, revenue: 58, users: 85 },
  }
}
