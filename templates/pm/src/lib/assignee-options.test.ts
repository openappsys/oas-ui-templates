import { describe, expect, it } from 'vitest'
import type { Member } from '@/types'
import { buildAssigneeOptions } from './assignee-options'
import { UNASSIGNED } from './filters'

const member = (id: string, name: string): Member => ({
  id,
  name,
  email: `${id}@oas.dev`,
  avatarColor: '#000',
  role: 'member',
})

const labels = { unassigned: '未分配' }

describe('buildAssigneeOptions', () => {
  it('成员在前（名 + 窗口计数后缀），「未分配」哨兵在末项', () => {
    const options = buildAssigneeOptions(
      [member('member-1', '张伟'), member('member-2', '李娜')],
      new Map([['member-1', 58]]),
      labels,
    )
    expect(options).toEqual([
      { label: '张伟 (58)', value: 'member-1' },
      { label: '李娜 (0)', value: 'member-2' },
      { label: '未分配', value: UNASSIGNED },
    ])
  })

  it('成员表未就绪（undefined）时只剩「未分配」：下拉不空', () => {
    expect(buildAssigneeOptions(undefined, new Map(), labels)).toEqual([
      { label: '未分配', value: UNASSIGNED },
    ])
  })

  it('「未分配」项不带计数后缀（计数只描述窗口内的具名成员行）', () => {
    const options = buildAssigneeOptions([member('a', 'A')], new Map([['a', 3]]), labels)
    expect(options.at(-1)).toEqual({ label: '未分配', value: UNASSIGNED })
  })
})
