<script lang="ts">
  // src/pages/roles.svelte —— 角色管理（表格 CRUD + 抽屉表单 + 数据权限单选 + 部门 transfer）
  // 1. 声明式模板——roles/deptList/editingId/dataScope/deptIds/drawerOpen 全部 $state，抽屉标题/
  //    customField 显隐全部由 state 派生；useT() 订阅 locale 后整页重渲，rules/labels/radio
  //    选项文案随 locale 自动重算
  // 2. 事件绑定：表格行点击（composedPath 匹配 [data-edit]）、oas-form 的 oas-submit、
  //    oas-transfer 的 oas-change 走展开通道直绑；popconfirm 的 oas-ok、radio 组的 oas-change
  //    （kebab 自定义事件）走 bind:this + $effect 容器委托；页头新建/面板内取消保存为
  //    oas-button 原生 click 直绑（Svelte 对 custom element 不走根委托，panel 内亦可达）
  // 3. columns 含 render 函数（scopeCell/actionCell 返回真实 DOM 节点）→ property 通道，
  //    按 locale 重建；transfer value 只在回填时写，切换数据权限 effect 里命令式同步 radio
  //    （setRadioChecked 同款通道，避免与组件 excludeSameName 打架）
  // 4. 已知怪癖（vanilla 同款，保持不修）：#rf-custom 的 [hidden] 被 .form-field 的 display 压过
  import { onMount } from 'svelte'
  import type { TableColumn } from '@oas-ui/ui/data/table'
  import type { DataScope, DeptTree, RoleRow } from '../data/system'
  import { createRole, listDepts, listRoles, removeRole, treeDepts, updateRole } from '../data/system'
  import { useT } from '../lib/use-t.svelte'
  import { appMessage } from '../lib/app-message'

  /** vanilla DATA_SCOPE_TAG：数据权限 → 标签色 */
  const DATA_SCOPE_TAG: Record<DataScope, string> = {
    1: 'primary',
    2: 'warning',
    3: 'info',
    4: 'info',
    5: 'default',
  }

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时整页重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let roles = $state<RoleRow[]>([])
  let deptTree = $state<DeptTree[]>([])
  let editingId = $state<number | null>(null)
  let dataScope = $state<DataScope>(1)
  let deptIds = $state<number[]>([])
  let drawerOpen = $state(false)
  let saving = false // 防重入（非响应式）

  let tableWrapEl: HTMLDivElement | null = $state(null)
  let drawerEl: HTMLElement | null = $state(null)
  let formEl: HTMLElement | null = $state(null)
  let scopeGroupEl: HTMLDivElement | null = $state(null)
  let transferEl: HTMLElement | null = $state(null)
  let nameEl: HTMLElement | null = $state(null)
  let codeEl: HTMLElement | null = $state(null)

  const editingRow = $derived(
    editingId != null ? (roles.find((r) => r.id === editingId) ?? null) : null,
  )

  /** vanilla flatten：部门树拍平（transfer 候选列表用） */
  const deptList = $derived.by(() => {
    const out: DeptTree[] = []
    const walk = (nodes: DeptTree[]) => {
      for (const n of nodes) {
        out.push(n)
        if (n.children?.length) walk(n.children)
      }
    }
    walk(deptTree)
    return out
  })

  /** vanilla scopeCell：行内数据权限标签 */
  function scopeCell(row: RoleRow): HTMLElement {
    const tag = document.createElement('oas-tag')
    tag.setAttribute('type', DATA_SCOPE_TAG[row.dataScope])
    tag.textContent = t(`roles.scope.${row.dataScope}`)
    return tag
  }

  /** vanilla actionCell：编辑按钮 + popconfirm 包裹的删除按钮 */
  function actionCell(row: RoleRow): HTMLElement {
    const ctx = document.createElement('div')
    ctx.className = 'action-cell'
    const edit = document.createElement('oas-button')
    edit.setAttribute('data-edit', String(row.id))
    edit.setAttribute('size', 'small')
    edit.setAttribute('type', 'text')
    edit.textContent = t('common.edit')
    const pop = document.createElement('oas-popconfirm')
    pop.setAttribute('data-del', String(row.id))
    pop.setAttribute('title', t('roles.confirmDelete'))
    const del = document.createElement('oas-button')
    del.setAttribute('size', 'small')
    del.setAttribute('type', 'danger')
    del.textContent = t('common.delete')
    pop.appendChild(del)
    ctx.appendChild(edit)
    ctx.appendChild(pop)
    return ctx
  }

  /** vanilla TABLE_COLUMNS（含 render 函数 → property 通道，按 locale 重建） */
  const columns = $derived.by<TableColumn[]>(() => {
    void $locale
    return [
      { key: 'name', title: tt('roles.th.name') },
      { key: 'code', title: tt('roles.th.code') },
      {
        key: 'dataScope',
        title: tt('roles.th.dataScope'),
        render: (r) => scopeCell(r as unknown as RoleRow),
      },
      { key: 'userCount', title: tt('roles.th.userCount'), align: 'right' },
      { key: 'created', title: tt('roles.th.created') },
      {
        key: 'action',
        title: tt('roles.th.action'),
        render: (r) => actionCell(r as unknown as RoleRow),
      },
    ]
  })

  const tableAttrs = $derived.by(() => ({
    columns,
    data: JSON.stringify(roles),
    'empty-text': tt('roles.empty'),
  }))

  /** vanilla DATA_SCOPE_OPTIONS */
  const scopeOptions = $derived.by(() => {
    void $locale
    return ([1, 2, 3, 4, 5] as const).map((v) => ({
      value: v,
      label: tt(`roles.scopeOpt.${v}`),
      desc: tt(`roles.scopeDesc.${v}`),
    }))
  })

  const rules = $derived(
    JSON.stringify({
      name: [{ required: true, message: tt('roles.rule.name') }],
      code: [
        { required: true, message: tt('roles.rule.code') },
        { pattern: '^[a-z][a-z0-9:_-]*$', message: tt('roles.rule.codeFmt') },
      ],
    }),
  )

  const transferAttrs = $derived.by(() => ({
    'source-title': tt('roles.transfer.source'),
    'target-title': tt('roles.transfer.target'),
    searchable: '',
    data: JSON.stringify(deptList.map((d) => ({ key: String(d.id), label: d.name }))),
    'onoas-change': onTransferChange,
  }))

  // 角色/部门树双路加载（变更后一并重取，等价 react 版缓存失效）
  async function refresh(): Promise<void> {
    const [roleRows, deptRows] = await Promise.all([listRoles(), treeDepts()])
    roles = roleRows
    deptTree = deptRows
  }

  // 初载（onMount 不建立响应式依赖）
  onMount(() => {
    void refresh()
  })

  /** radio checked 命令式同步（与组件 excludeSameName 同通道） */
  function setRadioChecked(scope: DataScope): void {
    scopeGroupEl?.querySelectorAll<HTMLElement>('oas-radio').forEach((radio) => {
      if (Number(radio.getAttribute('value')) === scope) radio.setAttribute('checked', '')
      else radio.removeAttribute('checked')
    })
  }

  // 数据权限变化 / locale 重挂 radio 组后 / 抽屉回填后：同步 checked
  $effect(() => {
    void $locale
    void dataScope
    void drawerOpen
    setRadioChecked(dataScope)
  })

  // 抽屉 open 边沿回填：字段值 + 数据权限 + transfer 选中（transfer value 只在回填时写）
  $effect(() => {
    if (!drawerOpen) return
    void editingId
    const row = editingRow
    nameEl?.setAttribute('value', row?.name ?? '')
    codeEl?.setAttribute('value', row?.code ?? '')
    const scope = (row?.dataScope ?? 1) as DataScope
    const ids = row?.dataScope === 2 ? [...row.deptIds] : []
    dataScope = scope
    deptIds = ids
    transferEl?.setAttribute('value', JSON.stringify(ids.map(String)))
    setRadioChecked(scope)
  })

  // radio 组容器委托 oas-change（kebab 自定义事件不能在 div 上模板直绑）
  $effect(() => {
    const el = scopeGroupEl
    if (!el) return
    el.addEventListener('oas-change', onScopeChange)
    return () => el.removeEventListener('oas-change', onScopeChange)
  })

  function onScopeChange(e: Event): void {
    const radio = e.composedPath()[0] as HTMLElement
    if (!(radio instanceof HTMLElement) || !radio.hasAttribute('checked')) return
    const val = Number(radio.getAttribute('value'))
    if (!Number.isFinite(val)) return
    dataScope = val as DataScope
    if (val !== 2) deptIds = []
  }

  function onTransferChange(e: Event): void {
    deptIds = (e as CustomEvent<{ value: string[] }>).detail.value.map(Number)
  }

  // 表格行删除 popconfirm：oas-ok 容器委托（kebab 自定义事件不能在 div 上模板直绑）
  $effect(() => {
    const el = tableWrapEl
    if (!el) return
    el.addEventListener('oas-ok', onTableOk)
    return () => el.removeEventListener('oas-ok', onTableOk)
  })

  function onTableOk(e: Event): void {
    const src = (e as CustomEvent<{ source?: HTMLElement }>).detail?.source
    if (!src?.hasAttribute?.('data-del')) return
    void removeRole(Number(src.getAttribute('data-del'))).then((ok) => {
      if (!ok) appMessage.error(t('roles.notFound'))
      else appMessage.success(t('common.deleted'))
      void refresh()
    })
  }

  /** 表格行内编辑：composedPath 匹配 [data-edit]（点击源在 oas-table shadow 内，composed 可达） */
  function onTableWrapClick(e: MouseEvent): void {
    const btn = e
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-edit]'))
    if (!btn) return
    const row = roles.find((r) => r.id === Number(btn.getAttribute('data-edit')))
    if (row) {
      editingId = row.id
      drawerOpen = true
    }
  }

  function onCancel(): void {
    drawerOpen = false
  }

  /** 保存：触发 oas-form shadow 内原生 form 提交（跨 shadow requestSubmit 通道） */
  function onSave(): void {
    ;(formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

  /** oas-submit：值收集 + create/update 编排（校验失败不关抽屉） */
  async function onFormSubmit(e: Event): Promise<void> {
    if (saving) return
    const { values } = (e as CustomEvent<{ values: { name?: string; code?: string } }>).detail
    const name = values.name?.trim()
    const code = values.code?.trim()
    if (!name || !code) return
    saving = true
    try {
      const ids = dataScope === 2 ? deptIds : []
      if (editingId == null) {
        await createRole({ name, code, dataScope, deptIds: ids, userCount: 0 })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateRole(editingId, { name, code, dataScope, deptIds: ids })
        if (!updated) appMessage.error(t('roles.notFound'))
        else appMessage.success(t('common.saved'))
      }
      drawerOpen = false
    } finally {
      saving = false
    }
    await refresh()
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.roles')}</h1>
      <p class="page-subtitle">{tt('roles.subtitle')}</p>
    </div>
    <oas-button
      data-testid="role-create"
      type="primary"
      icon="plus"
      onclick={() => {
        editingId = null
        drawerOpen = true
      }}
    >
      {tt('roles.new')}
    </oas-button>
  </div>
  <oas-card class="list-card" title={tt('roles.list')}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="table-wrap" id="roles-wrap" bind:this={tableWrapEl} onclick={onTableWrapClick}>
      <oas-table data-testid="roles-table" {...{ 'row-key': 'id', ...tableAttrs }}></oas-table>
    </div>
  </oas-card>

  <oas-drawer
    bind:this={drawerEl}
    data-testid="role-form-drawer"
    title={editingId == null ? tt('roles.new') : tt('roles.editRole', { id: editingId })}
    placement="right"
    size="medium"
    no-footer
    visible={drawerOpen ? '' : null}
    onoas-close={() => (drawerOpen = false)}
  >
    <oas-form bind:this={formEl} {rules} onoas-submit={onFormSubmit}>
      <div class="role-form-body">
        <div class="form-field">
          <label class="form-label">
            {tt('roles.form.name')} <span class="req">*</span>
          </label>
          <oas-input bind:this={nameEl} data-testid="rf-name" name="name" placeholder={tt('roles.rule.name')}>
          </oas-input>
        </div>
        <div class="form-field">
          <label class="form-label">
            {tt('roles.form.code')} <span class="req">*</span>
          </label>
          <oas-input bind:this={codeEl} data-testid="rf-code" name="code" placeholder={tt('roles.placeholder.code')}>
          </oas-input>
          <div class="form-hint">{tt('roles.hint.code')}</div>
        </div>
        <div class="form-field">
          <label class="form-label">{tt('roles.form.dataScope')}</label>
          <div class="radio-group" id="rf-scope" bind:this={scopeGroupEl}>
            {#each scopeOptions as o (o.value)}
              <oas-radio name="dataScope" value={String(o.value)}>
                <span class="radio-item">
                  <span class="radio-label">{o.label}</span>
                  <span class="radio-desc">{o.desc}</span>
                </span>
              </oas-radio>
            {/each}
          </div>
        </div>
        <div class="form-field" id="rf-custom" hidden={dataScope !== 2}>
          <label class="form-label">{tt('roles.form.customScope')}</label>
          <oas-transfer
            bind:this={transferEl}
            data-testid="rf-transfer"
            id="rf-transfer"
            {...transferAttrs}
          ></oas-transfer>
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="rf-cancel" onclick={onCancel}>{tt('common.cancel')}</oas-button>
            <oas-button data-testid="rf-save" type="primary" onclick={onSave}>{tt('common.save')}</oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  </oas-drawer>
</div>

<style>
  /* 角色管理域样式（自 react 版 roles.css 迁入，作用域限本文件） */
  .role-form-body {
    display: flex;
    flex-direction: column;
    gap: var(--oas-space-4);
  }
  .role-form-body oas-transfer {
    width: 100%;
  }
  .role-form-body oas-transfer::part(panel) {
    flex: 1;
    width: auto;
    min-width: 0;
  }
</style>
