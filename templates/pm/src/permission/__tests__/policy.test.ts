import { describe, it, expect } from 'vitest'
import { can, roleCan, ACTIONS } from '@/permission/policy'
import type { Role } from '@/types'

const me = { id: 'm1', role: 'member' as const }
const myIssue = { assigneeId: 'm1', reporterId: 'x' }
const othersIssue = { assigneeId: 'm2', reporterId: 'x' }

describe('permission policy', () => {
  it('viewer 全部操作拒绝', () => {
    const viewer = { id: 'v1', role: 'viewer' as const }
    for (const a of ACTIONS) {
      expect(can(viewer, a, { issue: myIssue, comment: { authorId: 'v1' } }), a).toBe(false)
    }
  })

  it('member 可建/改 own/评论，不可删/批量', () => {
    expect(can(me, 'issue:create')).toBe(true)
    expect(can(me, 'issue:edit', { issue: myIssue })).toBe(true)
    expect(can(me, 'issue:edit', { issue: othersIssue })).toBe(false)
    expect(can(me, 'issue:change-status', { issue: myIssue })).toBe(true)
    expect(can(me, 'issue:change-assignee', { issue: othersIssue })).toBe(false)
    expect(can(me, 'issue:delete', { issue: myIssue })).toBe(false)
    expect(can(me, 'bulk:apply')).toBe(false)
    expect(can(me, 'bulk:delete')).toBe(false)
    expect(can(me, 'comment:create')).toBe(true)
    expect(can(me, 'comment:edit', { comment: { authorId: 'm1' } })).toBe(true)
    expect(can(me, 'comment:edit', { comment: { authorId: 'm2' } })).toBe(false)
    expect(can(me, 'comment:delete', { comment: { authorId: 'm2' } })).toBe(false)
    expect(can(me, 'view:save')).toBe(true)
    expect(can(me, 'view:delete')).toBe(true)
    expect(can(me, 'project:manage')).toBe(false)
    expect(can(me, 'member:manage')).toBe(false)
  })

  it('member 无 ctx 时编辑一律默认拒绝', () => {
    for (const a of ['issue:edit', 'issue:change-status', 'issue:change-assignee'] as const) {
      expect(can(me, a), a).toBe(false)
    }
  })

  it('member 可改自己报告的 Issue（reporter 兜底）', () => {
    const reported = { assigneeId: 'm2', reporterId: 'm1' }
    expect(can(me, 'issue:edit', { issue: reported })).toBe(true)
    expect(can(me, 'issue:change-status', { issue: reported })).toBe(true)
  })

  it('admin 全部操作通过', () => {
    const admin = { id: 'a1', role: 'admin' as const }
    for (const a of ACTIONS) {
      expect(can(admin, a, { issue: othersIssue }), a).toBe(true)
    }
  })
})

describe('roleCan（自定义角色）', () => {
  const custom: Role = {
    id: 'role-x',
    name: 'X',
    description: '',
    builtin: false,
    permissions: ['project:manage', 'issue:delete'],
  }

  it('自定义角色按权限无条件授予', () => {
    expect(roleCan(custom, 'm1', 'project:manage')).toBe(true)
    // 与内置 member 不同：非本人 Issue 也能删（无条件）
    expect(roleCan(custom, 'm1', 'issue:delete', { issue: othersIssue })).toBe(true)
    expect(roleCan(custom, 'm1', 'issue:create')).toBe(false)
    expect(roleCan(undefined, 'm1', 'issue:create')).toBe(false)
  })

  it('内置角色沿用 can() 的条件规则', () => {
    const member: Role = {
      id: 'member',
      name: 'Member',
      description: '',
      builtin: true,
      permissions: [],
    }
    expect(roleCan(member, 'm1', 'issue:edit', { issue: myIssue })).toBe(true)
    expect(roleCan(member, 'm1', 'issue:edit', { issue: othersIssue })).toBe(false)
  })
})
