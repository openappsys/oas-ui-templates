<script setup lang="ts">
// src/pages/dict-type-modal.vue —— 字典类型新建/编辑弹窗（oas-modal + oas-form + 2 字段）
// 行为事实来源：vanilla-html/src/pages/dict.ts 的 RULES_TYPE/openTypeForm/typeForm oas-submit 段
// 容器形态参照 category-form-modal.vue 先例
// 偏差记录（因果链）：
// 1. 回填：vanilla openTypeForm 逐字段 setAttribute；本模版在 open 边沿的 watch
//    （flush: 'post'，等 DOM 就位）做同样的事（表单字段非受控，value 全走 attribute 通道）
// 2. visible 受控：vanilla 靠组件自闭；本模版 visible 由父组件 state 单一持有，
//    监听 oas-close 上抛 close 回写（category-form-modal.vue 同款）
// 3. oas-submit：vanilla 在页面级做校验/持久化/提示/刷新；本模版上抛 submit(values)，
//    父组件持有 editingTypeId/类型列表状态做持久化（语义对齐 vanilla state.editingTypeId）
// 4. 文案刷新：vanilla refreshText 逐节点替换；本模版 useT() 订阅后标题/label/占位/
//    规则/按钮随 locale 自动重算
import { computed, ref, watch } from 'vue'
import { createDictType, updateDictType } from '../data/system'
import type { DictType } from '../data/system'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

interface FormValues {
  name: string
  code: string
}

const props = defineProps<{
  open: boolean
  /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingTypeId 语义 */
  editingId: number | null
  editing: DictType | null
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
const nameRef = ref<HTMLElement | null>(null)
const codeRef = ref<HTMLElement | null>(null)
const saving = ref(false)

const title = computed(() =>
  props.editing ? t('dict.editType', { name: props.editing.name }) : t('dict.newType'),
)

// vanilla RULES_TYPE()
const rules = computed(() =>
  JSON.stringify({
    name: [{ required: true, message: t('dict.rule.typeName') }],
    code: [{ required: true, message: t('dict.rule.typeCode') }],
  }),
)

// vanilla openTypeForm：open 边沿回填
watch(
  () => [props.open, props.editing],
  () => {
    if (!props.open) return
    const row = props.editing
    nameRef.value?.setAttribute('value', row?.name ?? '')
    codeRef.value?.setAttribute('value', row?.code ?? '')
  },
  { flush: 'post' },
)

// 保存=触发 oas-form 内部原生 form 提交（跨 shadow，category-form-modal.vue 同款模式）
function onSave(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

// vanilla typeForm oas-submit 段：trim 校验 → create/update → 提示 → 上抛 saved
async function onSubmit(e: Event): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    const values = (e as CustomEvent<{ values: FormValues }>).detail.values
    const name = values.name?.trim()
    const code = values.code?.trim()
    if (!name || !code) return
    if (props.editingId == null) {
      await createDictType({ name, code })
      appMessage.success(tt('common.created'))
    } else {
      const updated = await updateDictType(props.editingId, { name, code })
      if (!updated) appMessage.error(t('dict.notFoundType'))
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
    data-testid="dict-type-modal"
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
              {{ t('dict.form.typeName') }}
              <span class="req">*</span>
            </label>
            <oas-input ref="nameRef" data-testid="dtf-name" name="name" :placeholder="t('dict.placeholder.typeName')" />
          </div>
          <div class="form-field">
            <label class="form-label">
              {{ t('dict.form.typeCode') }}
              <span class="req">*</span>
            </label>
            <oas-input ref="codeRef" data-testid="dtf-code" name="code" :placeholder="t('dict.placeholder.typeCode')" />
          </div>
          <div class="form-actions">
            <oas-space justify="end">
              <oas-button data-testid="dtf-cancel" @click="emit('close')">
                {{ t('common.cancel') }}
              </oas-button>
              <oas-button data-testid="dtf-save" type="primary" @click="onSave">
                {{ t('common.save') }}
              </oas-button>
            </oas-space>
          </div>
        </div>
      </oas-form>
    </div>
  </oas-modal>
</template>
