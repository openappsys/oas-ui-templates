// src/hooks/use-logs.ts —— 日志域的 TanStack Query hooks
// 全量（统计卡）与过滤集（虚拟列表）拆成两个查询；过滤条件进 key，
// 条件变化即换 key 重查，清条件回落全量语义由 listLogs 自己保证
import { useQuery } from '@tanstack/react-query'
import { listLogs } from '../data/logs'
import type { LogLevel } from '../data/logs'

export const logKeys = {
  all: () => ['logs', 'all'] as const,
  filtered: (f: LogFilter) => ['logs', 'filtered', f] as const,
}

export interface LogFilter {
  level: LogLevel | 'all'
  keyword: string
  dateRange?: [string, string]
}

/** 全量日志（统计卡口径：今日/错误/告警计数） */
export function useLogsAll() {
  return useQuery({ queryKey: logKeys.all(), queryFn: () => listLogs() })
}

/** 过滤日志（虚拟列表数据源；level/keyword/dateRange 任一变化即重取） */
export function useLogsFiltered(filter: LogFilter) {
  return useQuery({
    queryKey: logKeys.filtered(filter),
    queryFn: () =>
      listLogs({
        level: filter.level,
        keyword: filter.keyword,
        dateRange: filter.dateRange,
      }),
  })
}
