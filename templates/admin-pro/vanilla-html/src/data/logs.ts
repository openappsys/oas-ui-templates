export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  time: string
  level: LogLevel
  operator: string
  action: string
  IP: string
}

export interface LogFilter {
  level?: LogLevel | 'all'
  keyword?: string
  dateRange?: [string, string]
}

const OPERATORS = ['张伟', '王芳', '李娜', '刘强', '陈静', '杨洋', '赵敏', '孙磊']

const ACTIONS = [
  '登录系统',
  '退出系统',
  '创建订单',
  '修改订单',
  '取消订单',
  '创建商品',
  '修改商品',
  '删除商品',
  '导出订单数据',
  '导出商品数据',
  '创建用户',
  '修改用户',
  '删除用户',
  '修改角色',
  '分配权限',
  '修改密码',
  '查看报表',
  '下载文件',
]

function localDate(t: string): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomIP(): string {
  return `${rand(1, 255)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`
}

function randomLevel(): LogLevel {
  const roll = Math.random()
  return roll < 0.7 ? 'info' : roll < 0.9 ? 'warn' : 'error'
}

function seed(): LogEntry[] {
  const rows: LogEntry[] = []
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  for (let i = 0; i < 5000; i++) {
    const t = new Date(rand(sevenDaysAgo, now))
    rows.push({
      id: `log-${i + 1}`,
      time: t.toISOString(),
      level: randomLevel(),
      operator: OPERATORS[rand(0, OPERATORS.length - 1)],
      action: ACTIONS[rand(0, ACTIONS.length - 1)],
      IP: randomIP(),
    })
  }
  rows.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  return rows
}

const rows: LogEntry[] = seed()

function delay<T>(value: T, ms = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function listLogs(filter?: LogFilter): Promise<LogEntry[]> {
  let list = [...rows]
  if (filter) {
    if (filter.level && filter.level !== 'all') {
      list = list.filter((r) => r.level === filter.level)
    }
    if (filter.keyword?.trim()) {
      const kw = filter.keyword.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.operator.toLowerCase().includes(kw) ||
          r.action.toLowerCase().includes(kw) ||
          r.IP.includes(kw),
      )
    }
    if (filter.dateRange) {
      const [start, end] = filter.dateRange
      list = list.filter((r) => {
        const d = localDate(r.time)
        return d >= start && d <= end
      })
    }
  }
  return delay(list)
}

export function resetLogs(): void {
  rows.length = 0
  rows.push(...seed())
}
