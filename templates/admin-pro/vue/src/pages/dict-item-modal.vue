<script setup lang="ts">
// src/pages/dict-item-modal.vue —— 字典键值新建/编辑弹窗（oas-modal + oas-form + 3 字段）
// 容器形态参照 category-form-modal.vue 先例
//    本模版在 open 边沿的 watch（flush: 'post'，等 DOM 就位）做同样的事（字段非受控）
//    监听 oas-close 上抛 close 回写（category-form-modal.vue 同款）
//    本模版上抛 submit(values)，父组件持有 editingItemId/selectedTypeId 做持久化
//    规则/按钮随 locale 自动重算
import { computed, ref, watch } from 'vue'
import { createDictItem, updateDictItem } from '../data/system'
import type { DictItem } from '../data/system'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

interface FormValues {
  label: string
  value: string
  sort: string
}

const props = defineProps<{
  open: boolean
  /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingItemId 语义 */
  editingId: number | null
  editing: DictItem | null
  /** 所属字典类型 id（父组件保证非空才打开） */
  typeId: number | null
}>()
const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const formRef = ref<HTMLElement | null>(null)
const labelRef = ref<HTMLElement | null>(null)
const valueRef = ref<HTMLElement | null>(null)
const sortRef = ref<HTMLElement | null>(null)
const saving = ref(false)

const title = computed(() =>
  props.editing ? t('dict.editItem', { label: props.editing.label }) : t('dict.newItem'),
)

const rules = computed(() =>
  JSON.stringify({
    label: [{ required: true, message: t('dict.rule.label') }],
    value: [{ required: true, message: t('dict.rule.value') }],
  }),
)

watch(
  () => [props.open, props.editing],
  () => {
    if (!props.open) return
    const row = props.editing
    labelRef.value?.setAttribute('value', row?.label ?? '')
    valueRef.value?.setAttribute('value', row?.value ?? '')
    sortRef.value?.setAttribute('value', row ? String(row.sort) : '')
  },
  { flush: 'post' },
)

// 保存=触发 oas-form 内部原生 form 提交（跨 shadow，category-form-modal.vue 同款模式）
function onSave(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

async function onSubmit(e: Event): Promise<void> {
  if (saving.value) return
  if (props.typeId == null) return
  saving.value = true
  try {
    const values = (e as CustomEvent<{ values: FormValues }>).detail.values
    const label = values.label?.trim()
    const value = values.value?.trim()
    if (!label || !value) return
    const sort = Number(values.sort) || 0
    if (props.editingId == null) {
      await createDictItem({ typeId: props.typeId, label, value, sort })
      appMessage.success(tt('common.created'))
    } else {
      const updated = await updateDictItem(props.editingId, { label, value, sort })
      if (!updated) appMessage.error(t('dict.notFoundItem'))
      else appMessage.success(tt('common.saved'))
    }
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <oas-modal
    data-testid="dict-item-modal"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <div class="modal-body">
      <h2>{{ title }}</h2>
      <oas-form ref="formRef" :rules="rules" @oas-submit="void onSubmit($event)">
        <div class="dict-form-body">
          <div class="form-field">
            <label class="form-label">
              {{ t('dict.form.label') }}
              <span class="req">*</span>
            </label>
            <oas-input ref="labelRef" data-testid="dif-label" name="label" :placeholder="t('dict.placeholder.label')" />
          </div>
          <div class="form-field">
            <label class="form-label">
              {{ t('dict.form.value') }}
              <span class="req">*</span>
            </label>
            <oas-input ref="valueRef" data-testid="dif-value" name="value" :placeholder="t('dict.placeholder.value')" />
          </div>
          <div class="form-field">
            <label class="form-label">{{ t('dict.form.sort') }}</label>
            <oas-input-number ref="sortRef" data-testid="dif-sort" name="sort" min="0" placeholder="1" />
          </div>
          <div class="form-actions">
            <oas-space justify="end">
              <oas-button data-testid="dif-cancel" @click="emit('close')">
                {{ t('common.cancel') }}
              </oas-button>
              <oas-button data-testid="dif-save" type="primary" @click="onSave">
                {{ t('common.save') }}
              </oas-button>
            </oas-space>
          </div>
        </div>
      </oas-form>
    </div>
  </oas-modal>
</template>
