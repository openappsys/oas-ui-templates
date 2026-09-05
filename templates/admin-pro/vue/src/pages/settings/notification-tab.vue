<script setup lang="ts">
// src/pages/settings/notification-tab.vue —— 通知 Tab：3 类通知 × 2 渠道开关矩阵
// 逐项对齐 vanilla settings.ts 通知段：仅持久化（oas-admin.settings.notif.{类型}.{渠道}），无 toast。
// 差异（因果链）：vanilla 初始渲染后不再管开关状态（组件自管理）；
// 本模版用受控 checks ref 防止 locale 切换等无关重渲染把开关打回挂载初值。
// 矩阵内 oas-switch 的 oas-change 在矩阵容器上委托：data-key 定位持久化键（vanilla 同款）。
import { ref } from 'vue'
import { useT } from '../../composables/use-t'
import { NOTIF_PREFIX, readBool } from '../../settings-init'

const NOTIF_ROWS: Array<{ key: string; labelKey: string }> = [
  { key: 'orders', labelKey: 'settings.notif.orders' },
  { key: 'inventory', labelKey: 'settings.notif.inventory' },
  { key: 'system', labelKey: 'settings.notif.system' },
]
const NOTIF_CHANNELS: Array<{ key: string; labelKey: string }> = [
  { key: 'inapp', labelKey: 'settings.notif.inapp' },
  { key: 'email', labelKey: 'settings.notif.email' },
]

function readChecks(): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const row of NOTIF_ROWS) {
    for (const c of NOTIF_CHANNELS) {
      map[`${row.key}.${c.key}`] = readBool(`${NOTIF_PREFIX}${row.key}.${c.key}`, true)
    }
  }
  return map
}

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const checks = ref<Record<string, boolean>>(readChecks())

function onMatrixChange(e: Event): void {
  const sw = e.composedPath()[0] as HTMLElement
  const key = sw.getAttribute('data-key')
  if (!key) return
  const { checked } = (e as CustomEvent<{ checked: boolean }>).detail
  localStorage.setItem(NOTIF_PREFIX + key, String(checked))
  checks.value[key] = checked
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
