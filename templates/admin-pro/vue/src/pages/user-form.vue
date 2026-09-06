<script setup lang="ts">
// src/pages/user-form.vue —— 用户新建/编辑弹窗（oas-modal + oas-form）
// 行为事实来源：vanilla-html/src/pages/users.ts 的 RULES/fillForm/form-save/oas-submit 段
// （react 版 Task 9 并行中仍为占位，以 vanilla 为准；容器形态参照 product-form.vue 先例）
// 偏差记录（因果链）：
// 1. 回填：vanilla fillForm 逐字段 setAttribute；本模版在 open 边沿的 watch（flush: 'post'，
//    等 DOM 就位）里做同样的事（表单字段非受控，value 全走 attribute，与 vanilla 同一通道）
// 2. visible 受控：vanilla 靠组件自闭（遮罩/Esc 时自摘 visible）；本模版 visible 由父组件
//    state 单一持有，监听 oas-close 上抛 close 回写（product-form.vue 同款）
// 3. 取消/保存按钮位于 oas-modal panel 内：vanilla/react 因 panel 对原生 click
//    stopPropagation 需直绑 addEventListener；Vue 的 @click 直绑元素本身不走根委托，
//    不受影响（AGENTS.md 第 5 条）
// 4. 角色选项：vanilla refresh() 里 setAttribute('options')；本模版 options 走声明式 JSON
//    attribute 随 roles prop 重算，回填仅写 value attribute
// 5. 文案刷新：vanilla refreshText 逐节点替换；本模版 useT() 订阅后 rules/options/标题
//    随 locale 自动重算
import { computed, ref, watch } from 'vue'
import type { UserRow, UserStatus } from '../data/users'
import { createUser, updateUser } from '../data/users'
import type { RoleRow } from '../data/system'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

interface FormValues {
  name: string
  email: string
  roleId: string
  status: UserStatus
}

const props = defineProps<{
  open: boolean
  /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义 */
  editingId: number | null
  editing: UserRow | null
  roles: RoleRow[]
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
const emailRef = ref<HTMLElement | null>(null)
const roleRef = ref<HTMLElement | null>(null)
const statusRef = ref<HTMLElement | null>(null)
const saving = ref(false)

// vanilla roleEnumFor：角色行 code → 用户角色枚举
function roleEnumFor(roleRow: RoleRow | undefined): UserRow['role'] {
  if (!roleRow) return 'viewer'
  if (roleRow.code === 'super_admin') return 'admin'
  if (roleRow.code === 'viewer') return 'viewer'
  return 'editor'
}

// vanilla fillForm：open 边沿回填（编辑值/新建默认取首个角色）
watch(
  () => [props.open, props.editing, props.roles],
  () => {
    if (!props.open) return
    nameRef.value?.setAttribute('value', props.editing?.name ?? '')
    emailRef.value?.setAttribute('value', props.editing?.email ?? '')
    roleRef.value?.setAttribute(
      'value',
      props.editing?.roleId != null
        ? String(props.editing.roleId)
        : String(props.roles[0]?.id ?? ''),
    )
    statusRef.value?.setAttribute('value', props.editing?.status ?? 'active')
  },
  { flush: 'post' },
)

const title = computed(() =>
  props.editingId == null
    ? t('users.new')
    : t('users.editUser').replace('#{id}', String(props.editingId)),
)
// 复杂数据走 JSON attribute 通道（AGENTS.md 第 3 条），随 locale/roles 重算
const rules = computed(() =>
  JSON.stringify({
    name: [{ required: true, message: t('users.rule.name') }],
    email: [
      { required: true, message: t('users.rule.email') },
      { pattern: '^\\S+@\\S+$', message: t('users.rule.emailFmt') },
    ],
  }),
)
const roleOptions = computed(() =>
  JSON.stringify(props.roles.map((r) => ({ label: r.name, value: String(r.id) }))),
)
const statusOptions = computed(() =>
  JSON.stringify([
    { label: t('users.status.active'), value: 'active' },
    { label: t('users.status.disabled'), value: 'disabled' },
  ]),
)

// 保存=触发 oas-form 内部原生 form 提交（跨 shadow，login.vue 同款模式）
function onSave(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

// vanilla oas-submit 段：roleId→角色枚举推导 → create/update → 关闭 + 刷新（失败也关，对齐 vanilla）
async function onSubmit(e: Event): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    const values = (e as CustomEvent<{ values: FormValues }>).detail.values
    const roleId = values.roleId ? Number(values.roleId) : null
    const roleRow = roleId != null ? props.roles.find((r) => r.id === roleId) : undefined
    const role = roleEnumFor(roleRow)
    if (props.editingId == null) {
      await createUser({
        name: values.name,
        email: values.email,
        role,
        roleId,
        status: values.status || 'active',
      })
      appMessage.success(tt('common.created'))
    } else {
      const updated = await updateUser(props.editingId, {
        name: values.name,
        email: values.email,
        role,
        roleId,
        status: values.status,
      })
      if (!updated) appMessage.error(tt('users.notFound'))
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
    data-testid="user-form-modal"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <div class="modal-body">
      <h2 id="form-title">{{ title }}</h2>
      <oas-form ref="formRef" id="user-form" :rules="rules" @oas-submit="onSubmit">
        <div class="form-grid">
          <oas-input ref="nameRef" data-testid="field-name" name="name" :placeholder="t('users.name')" />
          <oas-input ref="emailRef" data-testid="field-email" name="email" :placeholder="t('users.email')" />
          <oas-select ref="roleRef" data-testid="field-role" name="roleId" :options="roleOptions" />
          <oas-select ref="statusRef" data-testid="field-status" name="status" :options="statusOptions" />
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="form-cancel" @click="emit('close')">
              {{ t('common.cancel') }}
            </oas-button>
            <oas-button data-testid="form-save" type="primary" @click="onSave">
              {{ t('common.save') }}
            </oas-button>
          </oas-space>
        </div>
      </oas-form>
    </div>
  </oas-modal>
</template>
