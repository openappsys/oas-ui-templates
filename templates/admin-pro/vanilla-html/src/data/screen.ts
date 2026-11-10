import type { CategorySlice, ChannelSeries } from './board'

export interface ScreenKpi {
  key: 'gmv' | 'orders' | 'users' | 'conversion'
  value: number
  prefix?: string
  suffix?: string
  anim: boolean
}

export interface CountrySales {
  key: string
  name: string
  iso3: string
  lng: number
  lat: number
  value: number
}

export interface ScreenData {
  kpis: ScreenKpi[]
  countries: CountrySales[]
  monthRevenue: number[]
  categoryShare: CategorySlice[]
  channel: { series: ChannelSeries[] }
}

const KPIS: ScreenKpi[] = [
  { key: 'gmv', value: 12845678, prefix: '¥', anim: true },
  { key: 'orders', value: 1926, anim: true },
  { key: 'users', value: 328, anim: false },
  { key: 'conversion', value: 4.6, suffix: '%', anim: false },
]

const COUNTRIES: CountrySales[] = [
  { key: 'china', name: '中国', iso3: 'CHN', lng: 104, lat: 35, value: 3200000 },
  { key: 'usa', name: '美国', iso3: 'USA', lng: -98, lat: 39, value: 2800000 },
  { key: 'japan', name: '日本', iso3: 'JPN', lng: 138, lat: 37, value: 1500000 },
  { key: 'germany', name: '德国', iso3: 'DEU', lng: 10, lat: 51, value: 1200000 },
  { key: 'uk', name: '英国', iso3: 'GBR', lng: -2, lat: 54, value: 980000 },
  { key: 'france', name: '法国', iso3: 'FRA', lng: 2, lat: 47, value: 920000 },
  { key: 'india', name: '印度', iso3: 'IND', lng: 79, lat: 22, value: 1100000 },
  { key: 'brazil', name: '巴西', iso3: 'BRA', lng: -52, lat: -10, value: 760000 },
  { key: 'australia', name: '澳大利亚', iso3: 'AUS', lng: 134, lat: -25, value: 640000 },
  { key: 'canada', name: '加拿大', iso3: 'CAN', lng: -106, lat: 56, value: 720000 },
  { key: 'russia', name: '俄罗斯', iso3: 'RUS', lng: 100, lat: 61, value: 580000 },
  { key: 'korea', name: '韩国', iso3: 'KOR', lng: 128, lat: 37, value: 880000 },
  { key: 'singapore', name: '新加坡', iso3: 'SGP', lng: 104, lat: 1, value: 540000 },
  { key: 'saudi', name: '沙特阿拉伯', iso3: 'SAU', lng: 45, lat: 24, value: 480000 },
  { key: 'mexico', name: '墨西哥', iso3: 'MEX', lng: -102, lat: 24, value: 520000 },
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

export function screenData(): ScreenData {
  return {
    kpis: KPIS.map((k) => ({ ...k })),
    countries: COUNTRIES.map((c) => ({ ...c })),
    monthRevenue: [...MONTH_REVENUE],
    categoryShare: CATEGORY_SHARE.map((c) => ({ ...c })),
    channel: { series: CHANNEL_SERIES.map((s) => ({ ...s, data: [...s.data] })) },
  }
}

function walk(value: number, spread: number): number {
  return Math.max(0, Math.round(value * (1 + (Math.random() - 0.5) * spread)))
}

export function tickScreenData(prev: ScreenData): ScreenData {
  return {
    kpis: prev.kpis.map((k) => ({ ...k, value: walk(k.value, 0.02) })),
    countries: prev.countries.map((c) => ({ ...c, value: walk(c.value, 0.04) })),
    monthRevenue: [...prev.monthRevenue],
    categoryShare: prev.categoryShare.map((c) => ({ ...c })),
    channel: { series: prev.channel.series.map((s) => ({ ...s, data: [...s.data] })) },
  }
}
