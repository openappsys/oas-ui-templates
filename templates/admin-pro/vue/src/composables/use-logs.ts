// src/composables/use-logs.ts —— 日志领域数据 composable
// 全量列表 + 筛选结果（原 logs.vue 的 rows/filtered/level/keyword/dateRange 状态与
// onMounted 拉取、applyFilter 筛选逻辑），筛选条件变更后由页面调 applyFilter 重查
import { ref } from 'vue'
import { listLogs } from '../data/logs'
import type { LogEntry, LogLevel } from '../data/logs'

export function useLogsList() {
  const rows = ref<LogEntry[]>([])
  const filtered = ref<LogEntry[]>([])
  const level = ref<LogLevel | 'all'>('all')
  const keyword = ref('')
  const dateRange = ref<[string, string] | null>(null)

  /** 按当前筛选条件重查 filtered */
  async function applyFilter(): Promise<void> {
    filtered.value = await listLogs({
      level: level.value,
      keyword: keyword.value,
      dateRange: dateRange.value ?? undefined,
    })
  }

  /** 首次加载：拉全量 + 首次筛选 */
  async function load(): Promise<void> {
    rows.value = await listLogs()
    await applyFilter()
  }

  return { rows, filtered, level, keyword, dateRange, load, applyFilter }
}
