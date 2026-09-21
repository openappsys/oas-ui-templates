// 用户详情弹窗域（自 vanilla src/pages/users.ts detail 段移植）
// 拆分自 users.js 以守单文件 ≤400 行纪律（对齐 react user-detail.tsx 的拆分方式）
import { t } from './i18n.js'

// 各角色枚举在用户管理下可用的权限标识（vanilla ALLOWED 段逐字对齐）
export const ALLOWED = {
  admin: ['user:list', 'user:add', 'user:edit', 'user:delete'],
  editor: ['user:list', 'user:add', 'user:edit'],
  viewer: ['user:list'],
}

// 菜单树里按标题找 C 类节点（vanilla findMenu 逐字对齐）
export function findMenu(nodes, title) {
  for (const n of nodes) {
    if (n.title === title && n.type === 'C') return n
    if (n.children?.length) {
      const f = findMenu(n.children, title)
      if (f) return f
    }
  }
  return null
}

// 角色标签色调：roleId 命中已知角色用专用色，否则按枚举回落
export function roleTagType(target) {
  return target.roleId === 1 ? 'primary' : target.roleId === 4 ? 'default' : 'warning'
}

export function tagTypeForRole(role) {
  if (role === 'admin') return 'primary'
  if (role === 'editor') return 'warning'
  return 'default'
}

export function tagTypeForStatus(status) {
  return status === 'active' ? 'success' : 'danger'
}

// 菜单树「用户管理」下 F 类按钮节点的权限标识（vanilla userPerms 段）
export function userPerms(menuTree) {
  const node = findMenu(menuTree, '用户管理')
  if (!node) return []
  return (node.children ?? [])
    .filter((c) => c.type === 'F')
    .map((c) => c.perms ?? '')
    .filter(Boolean)
}

// 填充详情弹窗：头像 + 角色标签 + descriptions + 权限标识对照 + 删除按钮可用性
// ctx: { roleName(target), canMutate() }（避免与列表页 state 循环依赖，经参数注入）
export function renderDetail(target, ctx) {
  document.querySelector('#detail-avatar-text').textContent = target.name.charAt(0).toUpperCase()
  document.querySelector('#detail-name').textContent = target.name
  const roleTag = document.querySelector('#detail-role-tag')
  roleTag.textContent = ctx.roleName(target)
  roleTag.setAttribute(
    'type',
    target.roleId != null ? roleTagType(target) : tagTypeForRole(target.role),
  )
  const desc = document.querySelector('#detail-desc')
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
  text('#detail-role', ctx.roleName(target))
  const statusTag = desc.querySelector('#detail-status-tag')
  statusTag.textContent = t(`users.status.${target.status}`)
  statusTag.setAttribute('type', tagTypeForStatus(target.status))
  text('#detail-created', target.created)
  renderPerms(target, ctx)
  const delBtn = document.querySelector('[data-testid="detail-delete"]')
  if (!ctx.canMutate()) {
    delBtn.setAttribute('disabled', '')
    delBtn.setAttribute('title', t('common.noPerm'))
  } else {
    delBtn.removeAttribute('disabled')
    delBtn.removeAttribute('title')
  }
}

// 权限标识对照：角色可用 → success 色标签，否则 default（vanilla renderPerms 段）
function renderPerms(target, ctx) {
  const listEl = document.querySelector('#detail-perms-list')
  const perms = userPerms(ctx.menuTree)
  if (perms.length === 0) {
    listEl.innerHTML = '<oas-tag type="default">' + t('users.nonePerm') + '</oas-tag>'
    return
  }
  const allowed = new Set(ALLOWED[target.role])
  listEl.innerHTML = perms
    .map(
      (p) =>
        `<oas-tag class="mono" type="${allowed.has(p) ? 'success' : 'default'}">${p}</oas-tag>`,
    )
    .join('')
}
