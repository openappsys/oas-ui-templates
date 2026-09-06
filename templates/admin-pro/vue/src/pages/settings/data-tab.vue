<script setup lang="ts">
// src/pages/settings/data-tab.vue —— 数据与列表 Tab：表单呈现方式/每页条数
// 读写走 Pinia settings store（$subscribe 持久化键名不变）。
// Vue 化差异：oas-change 模板直绑；radio 组在组容器上委托、composedPath[0] 取实际变动的 radio。
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useT } from '../../composables/use-t'
import { appMessage } from '../../lib/app-message'
import { useSettingsStore } from '../../stores/settings'
import type { FormMode } from '../../settings-init'

const FORM_MODE_OPTIONS: Array<{ value: FormMode; labelKey: string; descKey: string }> = [
  {
    value: 'dialog',
    labelKey: 'settings.formMode.dialog',
    descKey: 'settings.formMode.dialogDesc',
  },
  {
    value: 'drawer',
    labelKey: 'settings.formMode.drawer',
    descKey: 'settings.formMode.drawerDesc',
  },
  { value: 'page', labelKey: 'settings.formMode.page', descKey: 'settings.formMode.pageDesc' },
]

const PAGE_SIZES = [5, 10, 20, 50]

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const store = useSettingsStore()
const { formMode, pageSize } = storeToRefs(store)

function onFormModeChange(e: Event): void {
  const radio = e.composedPath()[0] as HTMLElement
  if (!radio.hasAttribute('checked')) return
  const v = radio.getAttribute('value') as FormMode | null
  if (!v) return
  store.setFormMode(v)
  appMessage.success(tt('common.saved'))
}

function onPageSizeChange(e: Event): void {
  const { value } = (e as CustomEvent<{ value: string }>).detail
  if (!value) return
  store.setPageSize(value)
  appMessage.success(tt('common.saved'))
}

const pageSizeOptions = computed(() => {
  void locale.value
  return JSON.stringify(
    PAGE_SIZES.map((n) => ({
      label: tt('settings.pageSizeItem', { count: n }),
      value: String(n),
    })),
  )
})
</script>

<template>
  <div class="setting-group">
    <div class="setting-group-title">{{ t('settings.general.formModeTitle') }}</div>
    <div class="form-hint">{{ t('settings.general.formModeHint') }}</div>
    <div
      id="form-mode-group"
      class="radio-group"
      data-testid="form-mode-group"
      @oas-change="onFormModeChange"
    >
      <oas-radio
        v-for="o in FORM_MODE_OPTIONS"
        :key="o.value"
        name="formMode"
        :value="o.value"
        :checked="formMode === o.value ? '' : null"
      >
        <span class="radio-item">
          <span class="radio-label">{{ t(o.labelKey) }}</span>
          <span class="radio-desc">{{ t(o.descKey) }}</span>
        </span>
      </oas-radio>
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-row">
      <div>
        <div class="setting-label">{{ t('settings.general.pageSizeLabel') }}</div>
        <div class="setting-hint">{{ t('settings.general.pageSizeHint') }}</div>
      </div>
      <oas-select
        data-testid="page-size"
        :value="pageSize"
        :options="pageSizeOptions"
        @oas-change="onPageSizeChange"
      />
    </div>
  </div>
</template>
