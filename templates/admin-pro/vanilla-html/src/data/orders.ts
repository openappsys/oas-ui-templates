import { persist, restore } from './store'

export type OrderStatus = 'pending' | 'paid' | 'shipping' | 'done' | 'cancelled'

export interface OrderRow {
  id: string
  customer: string
  amount: number
  status: OrderStatus
  items: string[]
  created: string
  urgent?: boolean
  phone?: string
  note?: string
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return iso(new Date())
}

function monthOffset(n: number, day = 15): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(day)
  return iso(d)
}

function seed(): OrderRow[] {
  const raw: Array<[string, number, OrderStatus, string[], string]> = [
    ['华信科技', 12800, 'done', ['数码相机', '无线充电器'], today()],
    ['蓝海贸易', 8600, 'shipping', ['蓝牙耳机', '便携音箱'], today()],
    ['星野文化', 3200, 'pending', ['机械键盘'], today()],
    ['晨光实业', 21500, 'done', ['办公桌', '人体工学椅', '台灯'], monthOffset(1)],
    ['云图软件', 6900, 'paid', ['显示器', '扩展坞'], monthOffset(1)],
    ['远帆教育', 4500, 'pending', ['平板电脑'], monthOffset(1)],
    ['基石建筑', 9800, 'cancelled', ['安全帽', '防护手套'], monthOffset(1)],
    ['微澜传媒', 15600, 'paid', ['相机云台', '补光灯'], monthOffset(2)],
    ['青禾餐饮', 3200, 'shipping', ['咖啡机'], monthOffset(2)],
    ['启睿咨询', 7600, 'cancelled', ['投影仪'], monthOffset(2)],
    ['拓界物流', 18200, 'paid', ['液压叉车'], monthOffset(3)],
    ['静水深流', 1100, 'pending', ['保温杯', '雨伞'], monthOffset(3)],
  ]
  return raw.map(([customer, amount, status, items, created], i) => ({
    id: `SO-${String(10001 + i)}`,
    customer,
    amount,
    status,
    items,
    created,
    urgent: i % 3 === 0,
    phone: `138${String(10000000 + i * 123456).slice(-8)}`,
    note: i % 4 === 0 ? '请在工作日配送' : undefined,
  }))
}

const KEY = 'oas-admin.orders.v1'
const rows: OrderRow[] = restore(KEY, seed)
let seq = 10001 + rows.length - 1

function delay<T>(value: T, ms = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function listOrders(): Promise<OrderRow[]> {
  return delay([...rows])
}

export function getOrder(id: string): Promise<OrderRow | null> {
  const row = rows.find((r) => r.id === id)
  return delay(row ? { ...row } : null)
}

export function createOrder(data: Omit<OrderRow, 'id' | 'created'>): Promise<OrderRow> {
  const row: OrderRow = {
    ...data,
    id: `SO-${String(++seq)}`,
    created: today(),
  }
  rows.unshift(row)
  persist(KEY, rows)
  return delay(row)
}

export function updateOrderStatus(id: string, status: OrderStatus): Promise<OrderRow | null> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], status }
  persist(KEY, rows)
  return delay(rows[i])
}

export function resetOrders(): void {
  rows.length = 0
  rows.push(...seed())
  seq = 10001 + rows.length - 1
  localStorage.removeItem(KEY)
}
