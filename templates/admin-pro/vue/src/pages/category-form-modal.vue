<script setup lang="ts">
// src/pages/category-form-modal.vue —— 分类新建/编辑弹窗（oas-modal + oas-form + 5 字段）
// 行为事实来源：vanilla-html/src/pages/category.ts 的 RULES/fillForm/modal 表单段
// 容器形态参照 user-form.vue 先例
// 偏差记录（因果链）：
// 1. 回填：vanilla fillForm 逐字段 setAttribute（checked 存在性切换）；本模版在 open 边沿的
//    watch（flush: 'post'，等 DOM 就位）里做同样的事（表单字段非受控，value 全走 attribute，
//    与 vanilla 同一通道；oas-switch 的 checked 用存在性语义 :checked="cond ? '' : null"）
// 2. visible 受控：vanilla 靠组件自闭（遮罩/Esc 时自摘 visible）；本模版 visible 由父组件
//    state 单一持有，监听 oas-close 上抛 close 回写（user-form.vue 同款）
// 3. 保存/取消按钮在 modal panel 内：Vue 的 @click 直绑元素本身不走根委托，无 react 版
//    stopPropagation 陷阱（AGENTS.md 第 5 条）；保存=触发 oas-form 内部原生 form 提交
// 4. oas-submit：vanilla 在页面级做校验/持久化/提示/刷新；本模版上抛 submit(values)，
//    持久化在父组件（editingId 状态在父组件，语义对齐 vanilla state.editingId）
// 5. 文案刷新：vanilla refreshText 逐节点替换 label/placeholder/rules；本模版 useT() 订阅后
//    标题/label/placeholder/rules/按钮随 locale 自动重算
import { computed, ref, watch } from 'vue'
import { createCategory, updateCategory } from '../data/categories'
import type { CategoryRow } from '../data/categories'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

interface FormValues {
  name: string
  code: string
  sort: string
  status?: string
  desc?: string
}

const props = defineProps<{
  open: boolean
  /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义 */
  editingId: number | null
  editing: CategoryRow | null
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
const sortRef = ref<HTMLElement | null>(null)
const statusRef = ref<HTMLElement | null>(null)
const descRef = ref<HTMLElement | null>(null)
const saving = ref(false)

const title = computed(() => (props.editingId == null ? t('category.new') : t('category.edit')))

// vanilla RULES()
const rules = computed(() =>
  JSON.stringify({
    name: [{ required: true, message: t('category.rule.name') }],
    code: [{ required: true, message: t('category.rule.code') }],
  }),
)

// vanilla fillForm：open 边沿回填（新建默认排序 1、状态开）
watch(
  () => [props.open, props.editing],
  () => {
    if (!props.open) return
    const row = props.editing
    nameRef.value?.setAttribute('value', row?.name ?? '')
    codeRef.value?.setAttribute('value', row?.code ?? '')
    sortRef.value?.setAttribute('value', String(row?.sort ?? 1))
    // oas-switch checked 为存在性语义（AGENTS.md 第 2 条）：编辑关态移除，其余置空串
    if (!row || row.status === 'on') statusRef.value?.setAttribute('checked', '')
    else statusRef.value?.removeAttribute('checked')
    descRef.value?.setAttribute('value', row?.desc ?? '')
  },
  { flush: 'post' },
)

// 保存=触发 oas-form 内部原生 form 提交（跨 shadow，user-form.vue 同款模式）
function onSave(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

// vanilla oas-submit 段：trim 校验 → 组装 payload → create/update → 提示 → 关闭 + 刷新
async function onSubmit(e: Event): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    const values = (e as CustomEvent<{ values: FormValues }>).detail.values
    const name = values.name?.trim()
    const code = values.code?.trim()
    if (!name || !code) return
    const payload = {
      name,
      code,
      sort: Number(values.sort) || 1,
      status: values.status === 'off' ? ('off' as const) : ('on' as const),
      desc: values.desc?.trim() ?? '',
    }
    if (props.editingId == null) {
      await createCategory(payload)
      appMessage.success(tt('common.created'))
    } else {
      const updated = await updateCategory(props.editingId, payload)
      if (!updated) appMessage.error(tt('common.networkError'))
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
    data-testid="category-modal"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <div class="modal-body">
      <h2 id="category-modal-title">{{ title }}</h2>
      <oas-form ref="formRef" id="category-form" :rules="rules" @oas-submit="void onSubmit($event)">
        <div class="dict-form-body">
          <div class="form-field">
            <label class="form-label">
              {{ t('category.form.name') }}
              <span class="req">*</span>
            </label>
            <oas-input ref="nameRef" data-testid="cf-name" name="name" :placeholder="t('category.placeholder.name')" />
          </div>
          <div class="form-field">
            <label class="form-label">
              {{ t('category.form.code') }}
              <span class="req">*</span>
            </label>
            <oas-input ref="codeRef" data-testid="cf-code" name="code" :placeholder="t('category.placeholder.code')" />
          </div>
          <div class="form-field">
            <label class="form-label">{{ t('category.form.sort') }}</label>
            <oas-input-number ref="sortRef" data-testid="cf-sort" name="sort" min="0" placeholder="1" />
          </div>
          <div class="form-field">
            <label class="form-label">{{ t('category.form.status') }}</label>
            <!-- switch 与其他字段同为非受控：初始无 checked，开关态由 open 边沿 watch 回填 -->
            <oas-switch ref="statusRef" data-testid="cf-status" name="status" />
          </div>
          <div class="form-field">
            <label class="form-label">{{ t('category.form.desc') }}</label>
            <oas-input ref="descRef" data-testid="cf-desc" name="desc" :placeholder="t('category.placeholder.desc')" />
          </div>
          <div class="form-actions">
            <oas-space justify="end">
              <oas-button data-testid="cf-cancel" @click="emit('close')">
                {{ t('common.cancel') }}
              </oas-button>
              <oas-button data-testid="cf-save" type="primary" @click="onSave">
                {{ t('common.save') }}
              </oas-button>
            </oas-space>
          </div>
        </div>
      </oas-form>
    </div>
  </oas-modal>
</template>
