<script setup lang="ts">
// src/pages/dept-form-drawer.vue —— 部门新建/编辑抽屉（oas-drawer + oas-form + 树选择父级）
// 行为事实来源：vanilla-html/src/pages/dept.ts 的 RULES/fillForm/refreshParentOptions/
// oas-submit 段
// 偏差记录（因果链）：
// 1. 回填：vanilla fillForm 逐字段 setAttribute（父级树选择 options/expanded/value 亦在
//    open 边沿命令式写入，excludeId=编辑节点 id 以剪掉自身与后代）；本模版在 open 边沿的
//    watch（flush: 'post'，等 DOM 就位）做同样的事（表单字段非受控，与 vanilla 同一通道）
// 2. visible 受控：vanilla 靠组件自闭；本模版 visible 由父组件 state 单一持有，
//    监听 oas-close 上抛 close 回写（category-form-modal.vue 同款）
// 3. oas-submit：vanilla 在页面级做校验/持久化/提示/刷新；本模版上抛 submit(values)，
//    父组件持有 editingId/tree 状态做持久化（语义对齐 vanilla state.editingId）
// 4. 文案刷新：vanilla refreshText 逐节点替换；本模版 useT() 订阅后标题/label/占位/
//    规则/按钮随 locale 自动重算
import { computed, ref, watch } from 'vue'
import { createDept, updateDept } from '../data/system'
import type { DeptNode, DeptTree } from '../data/system'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

interface FormValues {
  name: string
  members: string
}

const props = defineProps<{
  open: boolean
  /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义 */
  editingId: number | null
  /** 编辑节点（回填用） */
  editing: DeptNode | null
  /** 新建子部门时的父节点（open 边沿决定初始父级） */
  parentForNew: DeptTree | null
  /** 当前部门树（构建父级树选择 options） */
  tree: DeptTree[]
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
const membersRef = ref<HTMLElement | null>(null)
const parentRef = ref<HTMLElement | null>(null)
const saving = ref(false)

const title = computed(() =>
  props.editing ? t('dept.editDept', { name: props.editing.name }) : t('dept.new'),
)

// vanilla RULES()
const rules = computed(
  () => JSON.stringify({ name: [{ required: true, message: t('dept.rule.name') }] }),
)

// ---- vanilla 树辅助函数（与页面 dept.vue 的同名函数保持同一行为） ----
function findNode(nodes: DeptTree[], id: number): DeptTree | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

function descendants(nodes: DeptTree[], id: number): Set<number> {
  const set = new Set<number>()
  const node = findNode(nodes, id)
  const walk = (list: DeptTree[]) => {
    for (const n of list) {
      set.add(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  if (node) walk(node.children ?? [])
  return set
}

function prune(node: DeptTree, excluded: Set<number>): DeptTree | null {
  if (excluded.has(node.id)) return null
  const children = (node.children ?? [])
    .map((c) => prune(c, excluded))
    .filter((c): c is DeptTree => c !== null)
  return { ...node, children }
}

function expandKeys(nodes: DeptTree[]): string[] {
  const keys: string[] = []
  const walk = (list: DeptTree[]) => {
    for (const n of list) {
      if (n.children?.length) {
        keys.push(String(n.id))
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return keys
}

// vanilla buildParentOptions：顶级行 + 剪掉 excludeId 自身与后代后的树
function buildParentOptions(excludeId: number | null): Array<Record<string, unknown>> {
  const toOpt = (list: DeptTree[]): Array<Record<string, unknown>> =>
    list.map((n) => ({
      value: String(n.id),
      label: n.name,
      children: n.children?.length ? toOpt(n.children) : undefined,
    }))
  let filtered = props.tree
  if (excludeId != null) {
    const excluded = descendants(props.tree, excludeId)
    excluded.add(excludeId)
    filtered = props.tree.map((n) => prune(n, excluded)).filter((n): n is DeptTree => n !== null)
  }
  return [{ value: '0', label: t('dept.option.top'), children: toOpt(filtered) }]
}

// vanilla refreshParentOptions + fillForm：open 边沿命令式回填（options/expanded/value 同通道）
watch(
  () => [props.open, props.editing, props.parentForNew],
  () => {
    if (!props.open) return
    const node = props.editing
    nameRef.value?.setAttribute('value', node?.name ?? '')
    membersRef.value?.setAttribute('value', node ? String(node.members) : '0')
    const pid = node?.parentId ?? props.parentForNew?.id ?? null
    parentRef.value?.setAttribute('value', String(pid ?? 0))
    parentRef.value?.setAttribute('options', JSON.stringify(buildParentOptions(node?.id ?? null)))
    parentRef.value?.setAttribute('expanded', JSON.stringify(expandKeys(props.tree)))
  },
  { flush: 'post' },
)

// 保存=触发 oas-form 内部原生 form 提交（跨 shadow，category-form-modal.vue 同款模式）
function onSave(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

// vanilla oas-submit 段：trim 校验 → 父级自检 → create/update → 提示 → 上抛 saved
async function onSubmit(e: Event): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    const values = (e as CustomEvent<{ values: FormValues }>).detail.values
    const name = values.name?.trim()
    if (!name) return
    const parentRaw = parentRef.value?.getAttribute('value') || '0'
    const parentId = parentRaw === '0' ? null : Number(parentRaw)
    const members = Number(values.members) || 0
    if (props.editingId != null && parentId === props.editingId) {
      appMessage.error(t('dept.err.parentSelf'))
      return
    }
    if (props.editingId == null) {
      await createDept({ name, parentId, members })
      appMessage.success(tt('common.created'))
    } else {
      const updated = await updateDept(props.editingId, { name, parentId, members })
      if (!updated) appMessage.error(t('dept.notFound'))
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
    data-testid="dept-form-drawer"
    :title="title"
    placement="right"
    size="medium"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <oas-form ref="formRef" :rules="rules" @oas-submit="void onSubmit($event)">
      <div class="dept-form-body">
        <div class="form-field">
          <label class="form-label">
            {{ t('dept.form.name') }}
            <span class="req">*</span>
          </label>
          <oas-input ref="nameRef" data-testid="df-name" name="name" :placeholder="t('dept.rule.name')" />
        </div>
        <div class="form-field">
          <label class="form-label">{{ t('dept.form.parent') }}</label>
          <oas-tree-select
            ref="parentRef"
            data-testid="df-parent"
            :placeholder="t('dept.placeholder.top')"
          />
        </div>
        <div class="form-field">
          <label class="form-label">{{ t('dept.form.members') }}</label>
          <oas-input-number ref="membersRef" data-testid="df-members" name="members" min="0" placeholder="0" />
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="df-cancel" @click="emit('close')">
              {{ t('common.cancel') }}
            </oas-button>
            <oas-button data-testid="df-save" type="primary" @click="onSave">
              {{ t('common.save') }}
            </oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  </oas-drawer>
</template>
