<script setup lang="ts">
// src/pages/role-form-drawer.vue —— 角色新建/编辑抽屉（数据权限单选 + 自定义部门穿梭框）
// 行为事实来源：vanilla-html/src/pages/roles.ts 的 RULES/fillForm/scopeGroup oas-change/
// transfer oas-change/form oas-submit 段
// 偏差记录（因果链）：
// 1. 回填：vanilla fillForm 逐字段 setAttribute（transfer value 在 open 边沿写入）；
//    本模版在 open 边沿的 watch（flush: 'post'，等 DOM 就位）做同样的事（字段非受控）
// 2. 数据权限单选 checked：vanilla setRadioChecked 逐个切存在性 attr；本模版用响应式
//    存在性绑定 :checked="dataScope === o.value ? '' : null"（AGENTS.md 第 2 条）；
//    自定义范围字段 hidden 同样派生（dataScope !== 2）
// 3. oas-submit：vanilla 在页面级做校验/持久化/提示/刷新；本模版上抛 submit(values)，
//    父组件持有 editingId/roles 状态做持久化（语义对齐 vanilla state.editingId）
// 4. 文案刷新：vanilla refreshText 重建单选组/替换 label/占位/rules；本模版 useT() 订阅后
//    标题/label/占位/提示/单选文案/rules/穿梭框标题随 locale 自动重算
import { computed, ref, watch } from 'vue'
import { createRole, updateRole } from '../data/system'
import type { DataScope, DeptTree, RoleRow } from '../data/system'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

interface FormValues {
  name: string
  code: string
}

const props = defineProps<{
  open: boolean
  /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义 */
  editingId: number | null
  /** 编辑行（回填用） */
  editing: RoleRow | null
  /** 部门平铺列表（穿梭框 data） */
  depts: DeptTree[]
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
const transferRef = ref<HTMLElement | null>(null)
const saving = ref(false)

// vanilla state.dataScope/deptIds（抽屉内部提交态）
const dataScope = ref<DataScope>(1)
const deptIds = ref<number[]>([])

const title = computed(() =>
  props.editingId == null ? t('roles.new') : t('roles.editRole').replace('#{id}', String(props.editingId)),
)

// vanilla RULES()
const rules = computed(() =>
  JSON.stringify({
    name: [{ required: true, message: t('roles.rule.name') }],
    code: [
      { required: true, message: t('roles.rule.code') },
      { pattern: '^[a-z][a-z0-9:_-]*$', message: t('roles.rule.codeFmt') },
    ],
  }),
)

// vanilla DATA_SCOPE_OPTIONS()：随 locale 重算
const scopeOptions = computed(() => [
  { value: 1, label: t('roles.scopeOpt.1'), desc: t('roles.scopeDesc.1') },
  { value: 2, label: t('roles.scopeOpt.2'), desc: t('roles.scopeDesc.2') },
  { value: 3, label: t('roles.scopeOpt.3'), desc: t('roles.scopeDesc.3') },
  { value: 4, label: t('roles.scopeOpt.4'), desc: t('roles.scopeDesc.4') },
  { value: 5, label: t('roles.scopeOpt.5'), desc: t('roles.scopeDesc.5') },
])

// vanilla refresh() 的 transfer data 段：部门平铺为 {key,label}
const transferData = computed(() =>
  JSON.stringify(props.depts.map((d) => ({ key: String(d.id), label: d.name }))),
)

// vanilla fillForm：open 边沿命令式回填（transfer value 同通道）
watch(
  () => [props.open, props.editing],
  () => {
    if (!props.open) return
    const row = props.editing
    nameRef.value?.setAttribute('value', row?.name ?? '')
    codeRef.value?.setAttribute('value', row?.code ?? '')
    dataScope.value = (row?.dataScope ?? 1) as DataScope
    deptIds.value = row?.dataScope === 2 ? [...row.deptIds] : []
    transferRef.value?.setAttribute('value', JSON.stringify(deptIds.value.map(String)))
  },
  { flush: 'post' },
)

// vanilla scopeGroup oas-change 段：仅新勾选的单选生效；非自定义范围清空 deptIds
function onScopeChange(e: Event): void {
  const radio = e.composedPath()[0] as HTMLElement
  if (!radio.hasAttribute?.('checked')) return
  const val = Number(radio.getAttribute('value'))
  if (!Number.isFinite(val)) return
  dataScope.value = val as DataScope
  if (dataScope.value !== 2) deptIds.value = []
}

// vanilla transfer oas-change 段
function onTransferChange(e: Event): void {
  deptIds.value = (e as CustomEvent<{ value: string[] }>).detail.value.map(Number)
}

// 保存=触发 oas-form 内部原生 form 提交（跨 shadow，category-form-modal.vue 同款模式）
function onSave(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

// vanilla form oas-submit 段：trim 校验 → create/update → 提示 → 上抛 saved
async function onSubmit(e: Event): Promise<void> {
  if (saving.value) return
  const values = (e as CustomEvent<{ values: FormValues }>).detail.values
  const name = values.name?.trim()
  const code = values.code?.trim()
  if (!name || !code) return
  saving.value = true
  try {
    const ids = dataScope.value === 2 ? deptIds.value : []
    if (props.editingId == null) {
      await createRole({ name, code, dataScope: dataScope.value, deptIds: ids, userCount: 0 })
      appMessage.success(tt('common.created'))
    } else {
      const updated = await updateRole(props.editingId, {
        name,
        code,
        dataScope: dataScope.value,
        deptIds: ids,
      })
      if (!updated) appMessage.error(t('roles.notFound'))
      else appMessage.success(tt('common.saved'))
    }
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <oas-drawer
    data-testid="role-form-drawer"
    :title="title"
    placement="right"
    size="medium"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <oas-form ref="formRef" :rules="rules" @oas-submit="void onSubmit($event)">
      <div class="role-form-body">
        <div class="form-field">
          <label class="form-label">
            {{ t('roles.form.name') }}
            <span class="req">*</span>
          </label>
          <oas-input ref="nameRef" data-testid="rf-name" name="name" :placeholder="t('roles.rule.name')" />
        </div>
        <div class="form-field">
          <label class="form-label">
            {{ t('roles.form.code') }}
            <span class="req">*</span>
          </label>
          <oas-input ref="codeRef" data-testid="rf-code" name="code" :placeholder="t('roles.placeholder.code')" />
          <div class="form-hint">{{ t('roles.hint.code') }}</div>
        </div>
        <div class="form-field">
          <label class="form-label">{{ t('roles.form.dataScope') }}</label>
          <div class="radio-group" @oas-change="onScopeChange">
            <oas-radio
              v-for="o in scopeOptions"
              :key="o.value"
              name="dataScope"
              :value="String(o.value)"
              :checked="dataScope === o.value ? '' : null"
            >
              <span class="radio-item">
                <span class="radio-label">{{ o.label }}</span>
                <span class="radio-desc">{{ o.desc }}</span>
              </span>
            </oas-radio>
          </div>
        </div>
        <div class="form-field" :hidden="dataScope !== 2">
          <label class="form-label">{{ t('roles.form.customScope') }}</label>
          <oas-transfer
            ref="transferRef"
            data-testid="rf-transfer"
            :data="transferData"
            :source-title="t('roles.transfer.source')"
            :target-title="t('roles.transfer.target')"
            searchable
            @oas-change="onTransferChange"
          />
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="rf-cancel" @click="emit('close')">
              {{ t('common.cancel') }}
            </oas-button>
            <oas-button data-testid="rf-save" type="primary" @click="onSave">
              {{ t('common.save') }}
            </oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  </oas-drawer>
</template>
