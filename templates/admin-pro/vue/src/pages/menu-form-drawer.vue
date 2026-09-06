<script setup lang="ts">
// src/pages/menu-form-drawer.vue —— 菜单新建/编辑抽屉（类型单选/父级树选择/权限字自动补全）
// typeGroup oas-change/path oas-input/form oas-submit 段
//    :checked="formType === 'M' ? '' : null"oas-change 后 formType
//    ref 更新即等价 setTypeRadio
//    （permsHint/pathReq），radio/path 输入的副作用（C 类自动补 perms）保留命令式
//    校验与树变更在父组件 menus.vue（editingId/tree 状态在父组件）；校验失败抽屉保持打开
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

const formType = ref<MenuType>('C')

const title = computed(() =>
  props.editing ? t('menus.editMenu', { title: props.editing.title }) : t('menus.new'),
)

const rules = computed(
  () => JSON.stringify({ name: [{ required: true, message: t('menus.rule.name') }] }),
)

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

const permsHint = computed(() => {
  if (formType.value === 'C') return t('menus.hint.autoPerms')
  if (formType.value === 'M') return t('menus.hint.noPermForDir')
  return t('menus.hint.required')
})
const pathReq = computed(() => (formType.value === 'C' ? '*' : ''))

function applyAutoPerms(): void {
  if (formType.value !== 'C') return
  const cur = permsRef.value?.getAttribute('value') ?? ''
  if (!cur) {
    const auto = autoPerms('C', pathRef.value?.getAttribute('value') ?? '')
    if (auto) permsRef.value?.setAttribute('value', auto)
  }
}

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

function onTypeChange(e: Event): void {
  const radio = e.composedPath()[0] as HTMLElement
  if (!radio.hasAttribute?.('checked')) return
  const v = radio.getAttribute('value')
  if (v === 'M' || v === 'C' || v === 'F') {
    formType.value = v
    applyAutoPerms()
  }
}

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

<style scoped>
/* 菜单抽屉样式（自 app.css 迁入）：.radio-group 基类多组件共用留全局，仅容器布局与行内提示迁入 */
.menu-form-body {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-4);
}
.menu-form-body oas-tree-select {
  width: 100%;
}
.form-hint-inline {
  font-size: var(--oas-font-size-xs);
  color: var(--oas-color-text-secondary);
  font-weight: 400;
}
</style>
