<script setup lang="ts">
// src/pages/logs-detail-modal.vue —— 日志详情弹窗（描述列表 6 项）
// oas-descriptions）与 detailModal oas-cancel 段
//    oas-cancel 与 oas-close 同为组件关闭回调，语义等价）
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

<style scoped>
/* 日志详情弹窗样式（自 logs.css 迁入） */
.logs-detail-body {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-3);
}
</style>
