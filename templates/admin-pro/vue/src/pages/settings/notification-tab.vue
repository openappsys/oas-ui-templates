<script setup lang="ts">
// src/pages/settings/notification-tab.vue —— 通知 Tab：3 类通知 × 2 渠道开关矩阵
// 读写走 Pinia settings store 的 notifChecks 状态（键 = 行.渠道，$subscribe 持久化键名不变）。
import { storeToRefs } from 'pinia'
import { useT } from '../../composables/use-t'
import { useSettingsStore } from '../../stores/settings'
import { NOTIF_CHANNELS, NOTIF_ROWS } from '../../settings-init'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

// 开关矩阵状态在 store（locale 切换等无关重渲染不会打回挂载初值）
const { notifChecks: checks } = storeToRefs(useSettingsStore())

function onMatrixChange(e: Event): void {
  const sw = e.composedPath()[0] as HTMLElement
  const key = sw.getAttribute('data-key')
  if (!key) return
  const { checked } = (e as CustomEvent<{ checked: boolean }>).detail
  useSettingsStore().setNotif(key, checked)
}
</script>

<template>
  <div class="setting-group">
    <div class="setting-group-title">{{ t('settings.notif.title') }}</div>
    <div
      id="notif-matrix"
      class="notif-matrix"
      data-testid="notif-matrix"
      @oas-change="onMatrixChange"
    >
      <div class="notif-row notif-head">
        <span>{{ t('settings.notif.type') }}</span>
        <span v-for="c in NOTIF_CHANNELS" :key="c.key" class="notif-col">
          {{ t(c.labelKey) }}
        </span>
      </div>
      <div v-for="row in NOTIF_ROWS" :key="row.key" class="notif-row">
        <span class="notif-channel">{{ t(row.labelKey) }}</span>
        <span v-for="c in NOTIF_CHANNELS" :key="c.key" class="notif-col">
          <oas-switch
            :data-testid="`notif-${row.key}-${c.key}`"
            :data-key="`${row.key}.${c.key}`"
            :checked="checks[`${row.key}.${c.key}`] ? '' : null"
          />
        </span>
      </div>
    </div>
  </div>
</template>
