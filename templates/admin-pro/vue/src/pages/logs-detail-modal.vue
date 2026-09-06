<script setup lang="ts">
// src/pages/logs-detail-modal.vue —— 日志详情弹窗（描述列表 6 项）
// 行为事实来源：vanilla-html/src/pages/logs.ts 的 openDetail 段（innerHTML 重建
// oas-descriptions）与 detailModal oas-cancel 段（react 版同期并行中仍为占位，以 vanilla 为准）
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla openDetail 每次重建 innerHTML；本模版声明式——entry prop 派生全部字段，
//    结构静态写出（节点 id 与 vanilla 一致：logs-detail-body）
// 2. visible 受控：vanilla oas-cancel 时 removeAttribute('visible')；本模版 visible 由父组件
//    state 单一持有，oas-close 上抛 close 回写（user-detail.vue 同款；vanilla 监听的
//    oas-cancel 与 oas-close 同为组件关闭回调，语义等价）
// 3. 级别标签配色：vanilla LEVEL_TAG（info=default/warn=warning/error=danger）
import { computed } from 'vue'
import type { LogEntry } from '../data/logs'
import { useT } from '../composables/use-t'

const props = defineProps<{
  open: boolean
  entry: LogEntry | null
}>()
const emit = defineEmits<{
  close: []
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

// vanilla LEVEL_TAG
const LEVEL_TAG: Record<LogEntry['level'], string> = {
  info: 'default',
  warn: 'warning',
  error: 'danger',
}

const levelLabel = computed(() => (props.entry ? t(`logs.level.${props.entry.level}`) : ''))
const levelTag = computed(() => (props.entry ? LEVEL_TAG[props.entry.level] : 'default'))
</script>

<template>
  <oas-modal
    data-testid="logs-detail"
    id="logs-detail"
    :title="t('logs.detailTitle')"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <div class="logs-detail-body" id="logs-detail-body">
      <oas-descriptions column="1">
        <oas-descriptions-item :label="t('logs.dl.id')">
          <span class="mono">{{ entry?.id ?? '' }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('logs.th.time')">
          <span class="mono">{{ entry?.time ?? '' }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('logs.th.level')">
          <oas-tag :type="levelTag">{{ levelLabel }}</oas-tag>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('logs.th.operator')">
          {{ entry?.operator ?? '' }}
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('logs.th.action')">
          {{ entry?.action ?? '' }}
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('logs.th.ip')">
          <span class="mono">{{ entry?.IP ?? '' }}</span>
        </oas-descriptions-item>
      </oas-descriptions>
    </div>
  </oas-modal>
</template>
