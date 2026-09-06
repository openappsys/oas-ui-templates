// src/pages/logs-shared.ts —— 日志中心页的纯函数助手与行模板（从 logs.tsx 拆出，
// 内容与 vanilla-html/src/pages/logs.ts 的模块级助手段逐字对齐）
import type { LogEntry, LogLevel } from '../data/logs'

export type TFunc = (key: string, params?: Record<string, string | number>) => string

export const LEVEL_VALUES: Array<LogLevel | 'all'> = ['all', 'info', 'warn', 'error']

/** vanilla LEVEL_TAG：级别 → 标签色 */
export const LEVEL_TAG: Record<LogLevel, string> = {
  info: 'default',
  warn: 'warning',
  error: 'danger',
}

export function levelLabel(level: LogLevel | 'all', t: TFunc): string {
  return t(`logs.level.${level}`)
}

export function levelOptions(t: TFunc): Array<{ label: string; value: LogLevel | 'all' }> {
  return LEVEL_VALUES.map((v) => ({ label: levelLabel(v, t), value: v }))
}

/** vanilla ITEM_HEIGHT：虚拟列表行高 */
export const ITEM_HEIGHT = 44

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** vanilla formatTime：本地时区 HH:mm:ss */
export function formatTime(t: string): string {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function dateKey(t: string): string {
  return iso(new Date(t))
}

/** vanilla anchorLabel：今天/昨天/「M月D日」 */
export function anchorLabel(d: string, t: TFunc): string {
  const today = iso(new Date())
  const yesterday = iso(new Date(Date.now() - 86400000))
  if (d === today) return t('logs.anchor.today')
  if (d === yesterday) return t('logs.anchor.yesterday')
  return t('logs.anchor.date', { month: d.slice(5, 7), day: d.slice(8, 10) })
}

export interface DateGroup {
  date: string
  label: string
  index: number
}

/** vanilla buildDateGroups：按日期切分过滤结果（index 为该日首行行号） */
export function buildDateGroups(rows: LogEntry[], t: TFunc): DateGroup[] {
  const groups: DateGroup[] = []
  let lastDate = ''
  for (let i = 0; i < rows.length; i++) {
    const d = dateKey(rows[i].time)
    if (d !== lastDate) {
      groups.push({ date: d, label: anchorLabel(d, t), index: i })
      lastDate = d
    }
  }
  return groups
}

/** vanilla 虚拟列表行模板（slot=item，含隔离样式） */
export const ITEM_TEMPLATE_HTML = `
  <style>
    .logs-cell {
      font-size: var(--oas-font-size-sm);
      color: var(--oas-color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .logs-cell.mono {
      font-family: var(--app-mono);
    }
    .logs-cell.logs-time {
      color: var(--oas-color-text-secondary);
    }
    @media (max-width: 768px) {
      .logs-cell {
        font-size: var(--oas-font-size-xs);
      }
    }
  </style>
  <span class="logs-cell logs-time mono" data-col="time"></span>
  <span class="logs-cell logs-level" data-col="level"><oas-tag size="small"></oas-tag></span>
  <span class="logs-cell logs-operator" data-col="operator"></span>
  <span class="logs-cell logs-action" data-col="action"></span>
  <span class="logs-cell logs-ip mono" data-col="ip"></span>`
