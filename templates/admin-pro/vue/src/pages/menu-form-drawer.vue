<script setup lang="ts">
// src/pages/menu-form-drawer.vue —— 菜单新建/编辑抽屉（类型单选/父级树选择/权限字自动补全）
// 行为事实来源：vanilla-html/src/pages/menus.ts 的 RULES/fillMenuForm/syncMenuType/
// typeGroup oas-change/path oas-input/form oas-submit 段
// 偏差记录（因果链）：
// 1. 回填：vanilla fillMenuForm 逐字段 setAttribute；本模版在 open 边沿的 watch
//    （flush: 'post'，等 DOM 就位）做同样的事（字段非受控，与 vanilla 同一通道）
// 2. 类型单选 checked：vanilla setTypeRadio 逐个切存在性 attr；本模版用响应式存在性绑定
//    :checked="formType === 'M' ? '' : null"（AGENTS.md 第 2 条），oas-change 后 formType
//    ref 更新即等价 setTypeRadio
// 3. 提示/必填星号：vanilla syncMenuType 写 textContent；本模版派生 computed
//    （permsHint/pathReq），radio/path 输入的副作用（C 类自动补 perms）保留命令式
// 4. 提交：vanilla 在 form oas-submit 里直接校验+改树；本模版上抛 submit(payload)，
//    校验与树变更在父组件 menus.vue（editingId/tree 状态在父组件）；校验失败抽屉保持打开
//    （vanilla return 不关抽屉，语义一致）
// 5. 文案刷新：vanilla refreshText 逐节点替换；本模版 useT() 订阅后标题/label/占位/
//    规则/单选文案/按钮随 locale 自动重算
import { computed, ref, watch } from 'vue'
import type { MenuTree, MenuType } from '../data/system'
import { autoPerms, expandKeys, parentOf } from './menu-tree'
import { useT } from '../composables/use-t'

// 抽屉上抛的提交载荷（校验与树变更在父组件 menus.vue）
export interface MenuFormPayload {
  name: string
  type: MenuType
  perms: string
  path: string
  parentId: number | null
}

const props = defineProps<{
  open: boolean
  /** 编辑节点（null=新建；标题/回填/默认父级来源） */
  editing: MenuTree | null
  /** 新建子菜单时的父节点 */
  parentForNew: MenuTree | null
  /** 当前菜单树（父级树选择 options/expanded） */
  tree: MenuTree[]
}>()
const emit = defineEmits<{
  close: []
  submit: [payload: MenuFormPayload]
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const formRef = ref<HTMLElement | null>(null)
const nameRef = ref<HTMLElement | null>(null)
const parentRef = ref<HTMLElement | null>(null)
const permsRef = ref<HTMLElement | null>(null)
const pathRef = ref<HTMLElement | null>(null)

// vanilla state.formType（抽屉内部 UI 态；初始 'C'）
const formType = ref<MenuType>('C')

const title = computed(() =>
  props.editing ? t('menus.editMenu', { title: props.editing.title }) : t('menus.new'),
)

// vanilla RULES()
const rules = computed(
  () => JSON.stringify({ name: [{ required: true, message: t('menus.rule.name') }] }),
)

// vanilla 父级树选择 options：顶级行 + 全树（不剪枝，自环/后代校验在提交段）
const parentOptions = computed(() => {
  void locale.value
  const toOpt = (list: MenuTree[]): Array<Record<string, unknown>> =>
    list.map((n) => ({
      value: String(n.id),
      label: n.title,
      children: n.children?.length ? toOpt(n.children) : undefined,
    }))
  return JSON.stringify([{ value: '0', label: t('menus.option.top'), children: toOpt(props.tree) }])
})
const parentExpanded = computed(() => JSON.stringify(expandKeys(props.tree)))

// vanilla syncMenuType 的提示/必填星号段（声明式派生）
const permsHint = computed(() => {
  if (formType.value === 'C') return t('menus.hint.autoPerms')
  if (formType.value === 'M') return t('menus.hint.noPermForDir')
  return t('menus.hint.required')
})
const pathReq = computed(() => (formType.value === 'C' ? '*' : ''))

// vanilla syncMenuType 的自动补 perms 副作用：C 类且 perms 为空 → 按 path 生成
function applyAutoPerms(): void {
  if (formType.value !== 'C') return
  const cur = permsRef.value?.getAttribute('value') ?? ''
  if (!cur) {
    const auto = autoPerms('C', pathRef.value?.getAttribute('value') ?? '')
    if (auto) permsRef.value?.setAttribute('value', auto)
  }
}

// vanilla fillMenuForm：open 边沿命令式回填（编辑态父级取 parentOf）
watch(
  () => [props.open, props.editing, props.parentForNew],
  () => {
    if (!props.open) return
    const node = props.editing
    formType.value = node?.type ?? 'C'
    nameRef.value?.setAttribute('value', node?.title ?? '')
    const pid = node ? parentOf(props.tree, node.id) : (props.parentForNew?.id ?? null)
    parentRef.value?.setAttribute('value', String(pid ?? 0))
    permsRef.value?.setAttribute('value', node?.perms ?? '')
    pathRef.value?.setAttribute('value', node?.path ?? '')
    applyAutoPerms()
  },
  { flush: 'post' },
)

// vanilla typeGroup oas-change 段：仅新勾选的单选（带 checked）生效
function onTypeChange(e: Event): void {
  const radio = e.composedPath()[0] as HTMLElement
  if (!radio.hasAttribute?.('checked')) return
  const v = radio.getAttribute('value')
  if (v === 'M' || v === 'C' || v === 'F') {
    formType.value = v
    applyAutoPerms()
  }
}

// vanilla pathInput oas-input 段：C 类且 perms 为空时按输入实时生成
function onPathInput(e: Event): void {
  if (formType.value !== 'C') return
  const cur = permsRef.value?.getAttribute('value') ?? ''
  if (!cur) {
    const auto = autoPerms('C', (e as CustomEvent<{ value: string }>).detail.value)
    if (auto) permsRef.value?.setAttribute('value', auto)
  }
}

// 保存=触发 oas-form 内部原生 form 提交（跨 shadow，category-form-modal.vue 同款模式）
function onSave(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

// vanilla form oas-submit 段的取值部分：name 来自事件 values，其余读属性（同通道）；
// 校验与树变更上抛父组件
function onSubmit(e: Event): void {
  const values = (e as CustomEvent<{ values: { name: string } }>).detail.values
  const name = values.name?.trim()
  if (!name) return
  const parentRaw = parentRef.value?.getAttribute('value') || '0'
  const parentId = parentRaw === '0' ? null : Number(parentRaw)
  const perms = (permsRef.value?.getAttribute('value') ?? '').trim()
  const path = (pathRef.value?.getAttribute('value') ?? '').trim()
  emit('submit', { name, type: formType.value, perms, path, parentId })
}
</script>

<template>
  <oas-drawer
    data-testid="menu-form-drawer"
    :title="title"
    placement="right"
    size="medium"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <oas-form ref="formRef" :rules="rules" @oas-submit="onSubmit">
      <div class="menu-form-body">
        <div class="form-field">
          <label class="form-label">
            {{ t('menus.form.name') }}
            <span class="req">*</span>
          </label>
          <oas-input ref="nameRef" data-testid="mf-name" name="name" :placeholder="t('menus.rule.name')" />
        </div>
        <div class="form-field">
          <label class="form-label">{{ t('menus.form.type') }}</label>
          <div class="radio-group inline" @oas-change="onTypeChange">
            <oas-radio name="menuType" value="M" :checked="formType === 'M' ? '' : null">
              <span class="radio-label">{{ t('menus.type.M') }}</span>
            </oas-radio>
            <oas-radio name="menuType" value="C" :checked="formType === 'C' ? '' : null">
              <span class="radio-label">{{ t('menus.type.C') }}</span>
            </oas-radio>
            <oas-radio name="menuType" value="F" :checked="formType === 'F' ? '' : null">
              <span class="radio-label">{{ t('menus.type.F') }}</span>
            </oas-radio>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">{{ t('menus.form.parent') }}</label>
          <oas-tree-select
            ref="parentRef"
            data-testid="mf-parent"
            :placeholder="t('menus.placeholder.top')"
            :options="parentOptions"
            :expanded="parentExpanded"
          />
        </div>
        <div class="form-field">
          <label class="form-label">
            {{ t('menus.form.perms') }}
            <span class="form-hint-inline">{{ permsHint }}</span>
          </label>
          <oas-input ref="permsRef" data-testid="mf-perms" name="perms" :placeholder="t('menus.placeholder.perms')" />
        </div>
        <div class="form-field">
          <label class="form-label">
            {{ t('menus.form.path') }}
            <span v-if="pathReq" class="req">{{ pathReq }}</span>
          </label>
          <oas-input
            ref="pathRef"
            data-testid="mf-path"
            name="path"
            :placeholder="t('menus.placeholder.path')"
            @oas-input="onPathInput"
          />
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="mf-cancel" @click="emit('close')">
              {{ t('common.cancel') }}
            </oas-button>
            <oas-button data-testid="mf-save" type="primary" @click="onSave">
              {{ t('common.save') }}
            </oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  </oas-drawer>
</template>
