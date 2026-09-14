/**
 * 用户详情弹窗（自 vanilla src/pages/users.ts 详情段去 TS 移植，DOM/类名/testid 逐字对齐）
 * 头像 + 角色徽标 + descriptions 明细 + 权限标识对照（角色拥有 → success，其余 → default）
 */
import { t } from './i18n.js'
import { ALLOWED, findMenu, roleLabel, roleTagType, statusLabel } from './user-shared.js'

/** @returns {string} 详情弹窗骨架（oas-modal 内容） */
export function detailModalHtml() {
  return `
        <div class="modal-body">
          <div class="detail-header">
            <oas-avatar id="detail-avatar" size="48"><span slot="fallback" id="detail-avatar-text"></span></oas-avatar>
            <div>
              <div id="detail-name" class="detail-name"></div>
              <oas-tag id="detail-role-tag" type="primary"></oas-tag>
            </div>
          </div>
          <oas-descriptions id="detail-desc" column="1"></oas-descriptions>
          <oas-divider></oas-divider>
          <div class="detail-perms-title form-label">${t('users.perm')}</div>
          <div id="detail-perms-list" class="detail-perms-list"></div>
          <oas-space justify="end">
            <oas-button data-testid="detail-edit" type="primary">${t('common.edit')}</oas-button>
            <oas-popconfirm title="${t('users.confirmDelete')}" id="delete-popconfirm">
              <oas-button data-testid="detail-delete" type="danger">${t('common.delete')}</oas-button>
            </oas-popconfirm>
          </oas-space>
        </div>`
}

/** 菜单树中「用户管理」节点下的按钮型权限标识 */
function userPerms(menuTree) {
  const node = findMenu(menuTree, '用户管理')
  if (!node) return []
  return (node.children ?? [])
    .filter((c) => c.type === 'F')
    .map((c) => c.perms ?? '')
    .filter(Boolean)
}

/** 权限标识对照渲染：角色拥有 → success 绿，其余 → default 灰 */
function renderPerms(el, role, menuTree) {
  const listEl = el.querySelector('#detail-perms-list')
  const perms = userPerms(menuTree)
  if (perms.length === 0) {
    listEl.innerHTML = '<oas-tag type="default">' + t('users.nonePerm') + '</oas-tag>'
    return
  }
  const allowed = new Set(ALLOWED[role])
  listEl.innerHTML = perms
    .map(
      (p) =>
        `<oas-tag class="mono" type="${allowed.has(p) ? 'success' : 'default'}">${p}</oas-tag>`,
    )
    .join('')
}

function tagTypeForStatus(status) {
  return status === 'active' ? 'success' : 'danger'
}

function tagTypeForRole(role) {
  if (role === 'admin') return 'primary'
  if (role === 'editor') return 'warning'
  return 'default'
}

/**
 * 填充并打开详情弹窗
 * @param {HTMLElement} el 页面根
 * @param {import('./data/users.js').UserRow} target 目标用户
 * @param {{ state: object, openModal: (m: HTMLElement) => void }} ctx 页面状态与开弹窗助手
 */
export function fillDetail(el, target, ctx) {
  const { state, openModal } = ctx
  const roleName = (row) => {
    if (row.roleId != null) {
      const r = state.roleMap.get(row.roleId)
      if (r) return r.name
    }
    return roleLabel(row.role)
  }
  el.querySelector('#detail-avatar-text').textContent = target.name.charAt(0).toUpperCase()
  el.querySelector('#detail-name').textContent = target.name
  const roleTag = el.querySelector('#detail-role-tag')
  roleTag.textContent = roleName(target)
  roleTag.setAttribute(
    'type',
    target.roleId != null ? roleTagType(target) : tagTypeForRole(target.role),
  )
  const desc = el.querySelector('#detail-desc')
  desc.innerHTML = `
      <oas-descriptions-item label="ID"><span id="detail-id"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.name')}"><span id="detail-name2"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.email')}"><span id="detail-email"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.role')}"><span id="detail-role"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.status')}"><oas-tag id="detail-status-tag"></oas-tag></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.created')}"><span id="detail-created"></span></oas-descriptions-item>`
  const text = (sel, v) => {
    desc.querySelector(sel).textContent = v
  }
  text('#detail-id', String(target.id))
  text('#detail-name2', target.name)
  text('#detail-email', target.email)
  text('#detail-role', roleName(target))
  const statusTag = desc.querySelector('#detail-status-tag')
  statusTag.textContent = statusLabel(target.status)
  statusTag.setAttribute('type', tagTypeForStatus(target.status))
  text('#detail-created', target.created)
  renderPerms(el, target.role, state.menuTree)
  // viewer 只读：禁用删除入口并以 title 提示
  const delBtn = el.querySelector('[data-testid="detail-delete"]')
  if (!ctx.canMutate()) {
    delBtn.setAttribute('disabled', '')
    delBtn.setAttribute('title', t('common.noPerm'))
  } else {
    delBtn.removeAttribute('disabled')
    delBtn.removeAttribute('title')
  }
  state.editingId = target.id
  openModal(el.querySelector('[data-testid="user-detail-modal"]'))
}
