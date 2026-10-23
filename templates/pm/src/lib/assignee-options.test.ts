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
  it('「未分配」置首（带全量计数），其后成员名 + 计数后缀', () => {
    const options = buildAssigneeOptions(
      [member('member-1', '张伟'), member('member-2', '李娜')],
      new Map([
        [UNASSIGNED, 7],
        ['member-1', 58],
      ]),
      labels,
    )
    expect(options).toEqual([
      { label: '未分配 (7)', value: UNASSIGNED },
      { label: '张伟 (58)', value: 'member-1' },
      { label: '李娜 (0)', value: 'member-2' },
    ])
  })

  it('成员表未就绪（undefined）时只剩「未分配」：下拉不空', () => {
    expect(buildAssigneeOptions(undefined, new Map(), labels)).toEqual([
      { label: '未分配 (0)', value: UNASSIGNED },
    ])
  })

  it('计数键与筛选值同键：未分配用 UNASSIGNED 哨兵取值，不与成员 id 混键', () => {
    const options = buildAssigneeOptions([member('a', 'A')], new Map([['a', 3]]), labels)
    expect(options.map((o) => o.value)).toEqual([UNASSIGNED, 'a'])
    expect(options[0].label).toBe('未分配 (0)')
    expect(options[1].label).toBe('A (3)')
  })
})
