<script lang="ts">
  // src/pages/category-form-modal.svelte —— 分类新建/编辑弹窗（oas-modal + oas-form + 5 字段）
  // 对齐 react 版 category.tsx 弹窗段 / vue 版 category-form-modal.vue：
  // 1. 表单字段非受控：open/editingId 变化经 $effect（等 DOM 就位）回填 value attribute
  //    （oas-switch checked 为存在性语义：编辑关态移除，其余置空串）
  // 2. 保存/取消按钮在 modal panel 内：Svelte 的 onclick 直绑元素本身（不走根委托），
  //    panel 对原生事件的 stopPropagation 无影响；保存=触发 oas-form 内部原生 form 提交
  // 3. visible 受控：oas-close 上抛 close 回写父级状态；rules 随 locale 重算
  import type { CategoryRow } from '../data/categories'
  import { createCategory, updateCategory } from '../data/categories'
  import { appMessage } from '../lib/app-message'
  import { useT } from '../lib/use-t.svelte'

  export interface CategoryFormValues {
    name: string
    code: string
    sort: string
    status?: string
    desc?: string
  }

  interface Props {
    open: boolean
    /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义 */
    editingId: number | null
    editing: CategoryRow | null
    onClose: () => void
    onSaved: () => void
  }

  let { open, editingId, editing, onClose, onSaved }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let formEl: HTMLElement | null = $state(null)
  let nameEl: HTMLElement | null = $state(null)
  let codeEl: HTMLElement | null = $state(null)
  let sortEl: HTMLElement | null = $state(null)
  let statusEl: HTMLElement | null = $state(null)
  let descEl: HTMLElement | null = $state(null)
  let saving = $state(false)

  /** vanilla RULES：name/code 必填 */
  const rules = $derived.by(() => {
    void $locale
    return JSON.stringify({
      name: [{ required: true, message: tt('category.rule.name') }],
      code: [{ required: true, message: tt('category.rule.code') }],
    })
  })

  // 打开弹窗（新建/编辑）时回填字段：$effect 在 DOM 更新后执行，元素引用已就位
  $effect(() => {
    if (!open) return
    nameEl?.setAttribute('value', editing?.name ?? '')
    codeEl?.setAttribute('value', editing?.code ?? '')
    sortEl?.setAttribute('value', String(editing?.sort ?? 1))
    if (statusEl) {
      if (editing) {
        if (editing.status === 'on') statusEl.setAttribute('checked', '')
        else statusEl.removeAttribute('checked')
      } else {
        statusEl.setAttribute('checked', '')
      }
    }
    descEl?.setAttribute('value', editing?.desc ?? '')
  })

  /** 保存=触发 oas-form 内部原生 form 提交（跨 shadow） */
  function onSave(): void {
    ;(formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

  async function onSubmit(e: Event): Promise<void> {
    if (saving) return
    saving = true
    try {
      const values = (e as CustomEvent<{ values: CategoryFormValues }>).detail.values
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
      if (editingId == null) {
        await createCategory(payload)
        appMessage.success(tt('common.created'))
      } else {
        const updated = await updateCategory(editingId, payload)
        if (!updated) appMessage.error(tt('common.networkError'))
        else appMessage.success(tt('common.saved'))
      }
      onSaved()
    } finally {
      saving = false
    }
  }
</script>

<oas-modal
  data-testid="category-modal"
  no-footer
  visible={open ? '' : null}
  onoas-close={onClose}
>
  <div class="modal-body">
    <h2 id="category-modal-title">{editingId == null ? tt('category.new') : tt('category.edit')}</h2>
    <oas-form bind:this={formEl} id="category-form" {rules} onoas-submit={onSubmit}>
      <div class="dict-form-body">
        <div class="form-field">
          <label class="form-label">
            {tt('category.form.name')} <span class="req">*</span>
          </label>
          <oas-input
            bind:this={nameEl}
            data-testid="cf-name"
            name="name"
            placeholder={tt('category.placeholder.name')}
          ></oas-input>
        </div>
        <div class="form-field">
          <label class="form-label">
            {tt('category.form.code')} <span class="req">*</span>
          </label>
          <oas-input
            bind:this={codeEl}
            data-testid="cf-code"
            name="code"
            placeholder={tt('category.placeholder.code')}
          ></oas-input>
        </div>
        <div class="form-field">
          <label class="form-label">{tt('category.form.sort')}</label>
          <oas-input-number bind:this={sortEl} data-testid="cf-sort" name="sort" min="0" placeholder="1"></oas-input-number>
        </div>
        <div class="form-field">
          <label class="form-label">{tt('category.form.status')}</label>
          <oas-switch bind:this={statusEl} data-testid="cf-status" name="status"></oas-switch>
        </div>
        <div class="form-field">
          <label class="form-label">{tt('category.form.desc')}</label>
          <oas-input
            bind:this={descEl}
            data-testid="cf-desc"
            name="desc"
            placeholder={tt('category.placeholder.desc')}
          ></oas-input>
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="cf-cancel" onclick={onClose}>{tt('common.cancel')}</oas-button>
            <oas-button data-testid="cf-save" type="primary" onclick={onSave}
              >{tt('common.save')}</oas-button
            >
          </oas-space>
        </div>
      </div>
    </oas-form>
  </div>
</oas-modal>

<style>
  /* 分类弹窗样式：.dict-form-body 为字典/分类弹窗共用的表单纵向布局（本组件 scoped 持有） */
  .dict-form-body {
    display: flex;
    flex-direction: column;
    gap: var(--oas-space-4);
  }
  .dict-form-body oas-input-number {
    width: 100%;
  }
</style>
