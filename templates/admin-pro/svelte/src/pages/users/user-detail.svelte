<script lang="ts">
  // src/pages/users/user-detail.svelte —— 用户详情弹窗（descriptions + 权限标识 + 编辑/删除）
  // 1. 全声明式——user/roleName/perms 由父组件 state 派生，重渲即最新（oas-descriptions 的
  //    items 走默认 slot，light DOM 子节点变化自然生效）
  // 2. 编辑/删除按钮位于 oas-modal 的 panel 内，panel 对原生 click stopPropagation；Svelte 的
  //    onclick 直绑元素本身，不受该陷阱影响；popconfirm 的 oas-ok 与 modal 的 oas-close
  //    自定义事件 onoas-* 直绑
  import type { UserRow } from '../../data/users'
  import { useT } from '../../lib/use-t.svelte'

  export interface UserPermItem {
    perm: string
    allowed: boolean
  }

  interface Props {
    open: boolean
    user: UserRow | null
    /** 角色显示名（roleMap 命中取角色名，否则取枚举文案；父组件 roleName() 同款） */
    roleName: string
    /** 角色标签色调（vanilla roleTagType/tagTypeForRole 段，父组件算好传入） */
    roleTagType: string
    perms: UserPermItem[]
    canMutate: boolean
    onClose: () => void
    onEdit: () => void
    onDelete: () => void
  }

  let { open, user, roleName, roleTagType, perms, canMutate, onClose, onEdit, onDelete }: Props =
    $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  function statusTagType(status: UserRow['status']): string {
    return status === 'active' ? 'success' : 'danger'
  }
</script>

<oas-modal
  data-testid="user-detail-modal"
  no-footer
  visible={open ? '' : null}
  onoas-close={() => onClose()}
>
  <div class="modal-body">
    <div class="detail-header">
      <oas-avatar id="detail-avatar" size="48">
        <span slot="fallback" id="detail-avatar-text">
          {user ? user.name.charAt(0).toUpperCase() : ''}
        </span>
      </oas-avatar>
      <div>
        <div id="detail-name" class="detail-name">{user?.name ?? ''}</div>
        <oas-tag id="detail-role-tag" type={roleTagType}>{roleName}</oas-tag>
      </div>
    </div>
    {#if user}
      <oas-descriptions id="detail-desc" column="1">
        <oas-descriptions-item label="ID">
          <span id="detail-id">{user.id}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('users.name')}>
          <span id="detail-name2">{user.name}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('users.email')}>
          <span id="detail-email">{user.email}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('users.role')}>
          <span id="detail-role">{roleName}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('users.status')}>
          <oas-tag id="detail-status-tag" type={statusTagType(user.status)}>
            {tt(`users.status.${user.status}`)}
          </oas-tag>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('users.created')}>
          <span id="detail-created">{user.created}</span>
        </oas-descriptions-item>
      </oas-descriptions>
    {/if}
    <oas-divider></oas-divider>
    <div class="detail-perms-title form-label">{tt('users.perm')}</div>
    <div id="detail-perms-list" class="detail-perms-list">
      {#if perms.length === 0}
        <oas-tag type="default">{tt('users.nonePerm')}</oas-tag>
      {:else}
        {#each perms as p (p.perm)}
          <oas-tag class="mono" type={p.allowed ? 'success' : 'default'}>{p.perm}</oas-tag>
        {/each}
      {/if}
    </div>
    <oas-space justify="end">
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <oas-button data-testid="detail-edit" type="primary" onclick={() => onEdit()}>
        {tt('common.edit')}
      </oas-button>
      <oas-popconfirm title={tt('users.confirmDelete')} id="delete-popconfirm" onoas-ok={() => onDelete()}>
        <oas-button
          data-testid="detail-delete"
          type="danger"
          disabled={!canMutate ? '' : null}
          title={!canMutate ? tt('common.noPerm') : undefined}
        >
          {tt('common.delete')}
        </oas-button>
      </oas-popconfirm>
    </oas-space>
  </div>
</oas-modal>
