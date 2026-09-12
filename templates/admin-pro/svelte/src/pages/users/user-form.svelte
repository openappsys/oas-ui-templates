<script lang="ts">
  // src/pages/users/user-form.svelte —— 用户表单弹窗（新建/编辑，modal 形态）
  // 1. visible 受控：父组件 state 单一持有；组件侧关闭（遮罩/Esc/✕）监听 onoas-close 回写
  // 2. 取消/保存按钮位于 oas-modal 的 panel 内，panel 对原生 click stopPropagation；Svelte 的
  //    onclick 直绑元素本身，不受该陷阱影响，直接模板直绑
  // 3. 字段非受控：打开/编辑行变化时 $effect 命令式回填 value attribute（对齐 vanilla fillForm）；
  //    rules/options 声明式 JSON attribute 随 roles/locale 重算
  import type { UserRow, UserRole, UserStatus } from '../../data/users'
  import { createUser, updateUser } from '../../data/users'
  import type { RoleRow } from '../../data/system'
  import { appMessage } from '../../lib/app-message'
  import { useT } from '../../lib/use-t.svelte'

  interface Props {
    open: boolean
    /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义（行被删仍可按 id 提交） */
    editingId: number | null
    editing: UserRow | null
    roles: RoleRow[]
    onClose: () => void
    onSaved: () => void
  }

  let { open, editingId, editing, roles, onClose, onSaved }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  /** vanilla roleEnumFor：按角色 code 映射 UserRole 枚举 */
  function roleEnumFor(roleRow: RoleRow | undefined): UserRole {
    if (!roleRow) return 'viewer'
    if (roleRow.code === 'super_admin') return 'admin'
    if (roleRow.code === 'viewer') return 'viewer'
    return 'editor'
  }

  let formEl = $state<HTMLElement | null>(null)
  let nameEl = $state<HTMLElement | null>(null)
  let emailEl = $state<HTMLElement | null>(null)
  let roleEl = $state<HTMLElement | null>(null)
  let statusEl = $state<HTMLElement | null>(null)
  let saving = $state(false)

  // 打开/编辑行/角色列表变化时回填（字段非受控，与 vanilla fillForm 同时机）
  $effect(() => {
    if (!open) return
    void roles
    nameEl?.setAttribute('value', editing?.name ?? '')
    emailEl?.setAttribute('value', editing?.email ?? '')
    roleEl?.setAttribute(
      'value',
      editing?.roleId != null ? String(editing.roleId) : String(roles[0]?.id ?? ''),
    )
    statusEl?.setAttribute('value', editing?.status ?? 'active')
  })

  function onCancel(): void {
    onClose()
  }

  // 保存：触发 oas-form 内部原生 form 提交（组件转抛 oas-submit）
  function onSave(): void {
    ;(formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

  interface FormValues {
    name: string
    email: string
    roleId: string
    status: UserStatus
  }

  async function onSubmit(e: Event): Promise<void> {
    if (saving) return
    saving = true
    try {
      const values = (e as CustomEvent<{ values: FormValues }>).detail.values
      const roleId = values.roleId ? Number(values.roleId) : null
      const roleRow = roleId != null ? roles.find((r) => r.id === roleId) : undefined
      const role = roleEnumFor(roleRow)
      if (editingId == null) {
        await createUser({
          name: values.name,
          email: values.email,
          role,
          roleId,
          status: values.status || 'active',
        })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateUser(editingId, {
          name: values.name,
          email: values.email,
          role,
          roleId,
          status: values.status,
        })
        if (!updated) {
          appMessage.error(t('users.notFound'))
        } else {
          appMessage.success(t('common.saved'))
        }
      }
      onSaved()
    } finally {
      saving = false
    }
  }

  const title = $derived.by(() => {
    void $locale
    return editingId == null
      ? t('users.new')
      : t('users.editUser').replace('#{id}', String(editingId))
  })
  const rules = $derived.by(() => {
    void $locale
    return JSON.stringify({
      name: [{ required: true, message: t('users.rule.name') }],
      email: [
        { required: true, message: t('users.rule.email') },
        { pattern: '^\\S+@\\S+$', message: t('users.rule.emailFmt') },
      ],
    })
  })
  const roleOptions = $derived(
    JSON.stringify(roles.map((r) => ({ label: r.name, value: String(r.id) }))),
  )
  const statusOptions = $derived.by(() => {
    void $locale
    return JSON.stringify([
      { label: t('users.status.active'), value: 'active' },
      { label: t('users.status.disabled'), value: 'disabled' },
    ])
  })
</script>

<oas-modal
  data-testid="user-form-modal"
  no-footer
  visible={open ? '' : null}
  onoas-close={() => onClose()}
>
  <div class="modal-body">
    <h2 id="form-title">{title}</h2>
    <oas-form bind:this={formEl} id="user-form" rules={rules} onoas-submit={(e) => void onSubmit(e)}>
      <div class="form-grid">
        <oas-input
          bind:this={nameEl}
          data-testid="field-name"
          name="name"
          placeholder={tt('users.name')}
        ></oas-input>
        <oas-input
          bind:this={emailEl}
          data-testid="field-email"
          name="email"
          placeholder={tt('users.email')}
        ></oas-input>
        <oas-select
          bind:this={roleEl}
          data-testid="field-role"
          name="roleId"
          options={roleOptions}
        ></oas-select>
        <oas-select
          bind:this={statusEl}
          data-testid="field-status"
          name="status"
          options={statusOptions}
        ></oas-select>
      </div>
      <div class="form-actions">
        <oas-space justify="end">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <oas-button data-testid="form-cancel" onclick={onCancel}>{tt('common.cancel')}</oas-button>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <oas-button data-testid="form-save" type="primary" onclick={onSave}>
            {tt('common.save')}
          </oas-button>
        </oas-space>
      </div>
    </oas-form>
  </div>
</oas-modal>
