import { describe, expect, it } from 'vitest'
import type { Member } from '@/types'
import {
  commentNotificationDrafts,
  issueChangeNotificationDrafts,
  mentionedMemberIds,
  snippet,
} from './notify'

const members: Member[] = [
  { id: 'm1', name: '张伟', email: 'a@oas.dev', avatarColor: '#000', role: 'admin' },
  { id: 'm2', name: '李娜', email: 'b@oas.dev', avatarColor: '#111', role: 'member' },
  { id: 'm3', name: '张伟明', email: 'c@oas.dev', avatarColor: '#222', role: 'viewer' },
  { id: 'm4', name: 'Li Na', email: 'd@oas.dev', avatarColor: '#333', role: 'viewer' },
]

describe('@提及解析', () => {
  it('按出现顺序返回去重后的成员 id', () => {
    expect(mentionedMemberIds('@李娜 看下，@张伟 补充', members)).toEqual(['m2', 'm1'])
    expect(mentionedMemberIds('@张伟 @张伟', members)).toEqual(['m1'])
  })

  it('长名优先：@张伟明 不再命中 张伟', () => {
    expect(mentionedMemberIds('@张伟明 在吗', members)).toEqual(['m3'])
    expect(mentionedMemberIds('@张伟明 和 @张伟', members)).toEqual(['m3', 'm1'])
  })

  it('邮箱/标识符内的 @ 不算提及', () => {
    expect(mentionedMemberIds('mail a@张伟.b', members)).toEqual([])
  })

  it('中文标点自然结束提及', () => {
    expect(mentionedMemberIds('@张伟，请确认', members)).toEqual(['m1'])
  })
})

describe('评论通知草稿', () => {
  const base = { issueId: 'i1', issueAssigneeId: 'm1', actorId: 'm2', members }

  it('提及他人 → mention；负责人同时被提及只收 mention，不叠加 comment', () => {
    expect(commentNotificationDrafts({ ...base, body: '@张伟 帮忙看下' })).toEqual([
      {
        memberId: 'm1',
        type: 'mention',
        issueId: 'i1',
        actorId: 'm2',
        message: '@张伟 帮忙看下',
      },
    ])
  })

  it('未提及负责人 → 负责人收到 comment', () => {
    expect(commentNotificationDrafts({ ...base, body: '进度如何' })).toEqual([
      {
        memberId: 'm1',
        type: 'comment',
        issueId: 'i1',
        actorId: 'm2',
        message: '进度如何',
      },
    ])
  })

  it('自己评论自己的 Issue 不通知自己；提及自己也不通知', () => {
    expect(
      commentNotificationDrafts({
        ...base,
        issueAssigneeId: 'm2',
        actorId: 'm2',
        body: '@李娜 备忘',
      }),
    ).toEqual([])
  })

  it('无负责人时只发 mention', () => {
    expect(
      commentNotificationDrafts({
        ...base,
        issueAssigneeId: null,
        body: '@张伟',
      }).map((d) => d.type),
    ).toEqual(['mention'])
  })
})

describe('变更通知草稿', () => {
  it('指派给他人 → assigned（新负责人）', () => {
    expect(
      issueChangeNotificationDrafts({
        issueId: 'i1',
        actorId: 'm2',
        prevAssigneeId: null,
        nextAssigneeId: 'm1',
      }),
    ).toEqual([{ memberId: 'm1', type: 'assigned', issueId: 'i1', actorId: 'm2' }])
  })

  it('指派给自己/解除指派 → 无通知', () => {
    expect(
      issueChangeNotificationDrafts({
        issueId: 'i1',
        actorId: 'm1',
        prevAssigneeId: null,
        nextAssigneeId: 'm1',
      }),
    ).toEqual([])
    expect(
      issueChangeNotificationDrafts({
        issueId: 'i1',
        actorId: 'm2',
        prevAssigneeId: 'm1',
        nextAssigneeId: null,
      }),
    ).toEqual([])
  })

  it('负责人未变 → 无 assigned', () => {
    expect(
      issueChangeNotificationDrafts({
        issueId: 'i1',
        actorId: 'm2',
        prevAssigneeId: 'm1',
        nextAssigneeId: 'm1',
      }),
    ).toEqual([])
  })

  it('关闭类状态（done/cancelled）通知当前负责人，message 存新状态码', () => {
    expect(
      issueChangeNotificationDrafts({
        issueId: 'i1',
        actorId: 'm2',
        prevAssigneeId: 'm1',
        prevStatus: 'in_progress',
        nextStatus: 'done',
      }),
    ).toEqual([{ memberId: 'm1', type: 'status', issueId: 'i1', actorId: 'm2', message: 'done' }])
  })

  it('同一次变更里指派给他人并关闭 → 只发 assigned，不叠加 status', () => {
    expect(
      issueChangeNotificationDrafts({
        issueId: 'i1',
        actorId: 'm2',
        prevAssigneeId: null,
        nextAssigneeId: 'm1',
        prevStatus: 'todo',
        nextStatus: 'done',
      }),
    ).toEqual([{ memberId: 'm1', type: 'assigned', issueId: 'i1', actorId: 'm2' }])
  })

  it('非关闭状态 / 自己操作 / 状态未变 → 无通知', () => {
    for (const input of [
      { prevStatus: 'todo' as const, nextStatus: 'in_progress' as const },
      { prevStatus: 'in_progress' as const, nextStatus: 'done' as const, actorId: 'm1' },
      { prevStatus: 'done' as const, nextStatus: 'done' as const },
    ]) {
      expect(
        issueChangeNotificationDrafts({
          issueId: 'i1',
          actorId: 'm2',
          prevAssigneeId: 'm1',
          ...input,
        }),
      ).toEqual([])
    }
  })
})

describe('snippet', () => {
  it('折叠空白并截断到 120 字内', () => {
    expect(snippet('  a\n\n b  ')).toBe('a b')
    const long = snippet('字'.repeat(200))
    expect(long.length).toBe(120)
    expect(long.endsWith('…')).toBe(true)
  })
})
