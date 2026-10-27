import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Issue } from '@/types'
import type { Repositories } from '@/data/types'
import { createAgentScheduler } from './agent-runner'

/** 可控的假仓库：issues 内存表 + 可手动触发的 liveAssignedTo 流 */
function makeFakeRepos(seed: Issue[]) {
  const table = new Map(seed.map((i) => [i.id, structuredClone(i)]))
  const comments: Array<{ issueId: string; authorId: string; body: string }> = []
  const activities: Array<{ issueId: string; actorId: string; type: string }> = []
  let subKey = 0
  const emitters = new Set<(issues: Issue[]) => void>()

  const repos = {
    issues: {
      get: async (id: string) => {
        const row = table.get(id)
        return row ? structuredClone(row) : undefined
      },
      update: async (id: string, changes: Partial<Issue>) => {
        const row = table.get(id)
        if (row) Object.assign(row, changes)
      },
      create: async (input: Record<string, unknown>) => {
        const id = `sub-${++subKey}`
        const row = {
          id,
          key: `OAS-${100000 + subKey}`,
          projectId: String(input.projectId ?? 'p1'),
          title: String(input.title ?? ''),
          description: String(input.description ?? ''),
          status: 'todo',
          priority: 'medium',
          assigneeId: (input.assigneeId as string) ?? null,
          reporterId: (input.reporterId as string) ?? 'm1',
          parentId: (input.parentId as string) ?? null,
          labels: [],
          startAt: null,
          dueAt: null,
          createdAt: 1,
          updatedAt: 1,
          order: 1,
        } as Issue
        table.set(id, row)
        return structuredClone(row)
      },
      // 调度器实际调用的方法：手动触发式流（测试里显式 emit 驱动）
      liveAssignedTo: (_ids: string[]) => ({
        subscribe: (obs: { next: (issues: Issue[]) => void }) => {
          const fn = (issues: Issue[]) => obs.next(issues)
          emitters.add(fn)
          return () => emitters.delete(fn)
        },
      }),
    },
    comments: {
      add: async (input: { issueId: string; authorId: string; body: string }) => {
        comments.push(input)
      },
    },
    activities: {
      log: async (entry: { issueId: string; actorId: string; type: string }) => {
        activities.push(entry)
      },
    },
  } as unknown as Repositories

  return {
    repos,
    table,
    comments,
    activities,
    /** 触发调度器重算（把当前表内 agent 名下在库行发出去） */
    emitAssigned(agentId: string) {
      const rows = [...table.values()].filter((i) => i.assigneeId === agentId && !i.deletedAt)
      for (const fn of emitters) fn(rows)
    },
  }
}

function agentIssue(id: string, over: Partial<Issue> = {}): Issue {
  return {
    id,
    projectId: 'p1',
    key: `OAS-${id}`,
    title: `任务 ${id}`,
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'agent-1',
    reporterId: 'm1',
    labels: [],
    startAt: null,
    dueAt: null,
    createdAt: 1,
    updatedAt: 1,
    order: 1,
    ...over,
  }
}

describe('agent 调度器', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('完整 run：评论推进 + 拆解子任务 + 状态流转 + 交付置 reviewRequired', async () => {
    const f = makeFakeRepos([agentIssue('i1')])
    // agent 名下的子任务不参与派发（防递归）
    f.table.set('sub-seed', agentIssue('sub-seed', { parentId: 'i1' }))
    const sched = createAgentScheduler({ repos: f.repos, agentIds: ['agent-1'], fast: true })
    f.emitAssigned('agent-1')

    // 4 步 × 150ms：轮询推进假时钟直到交付完成
    for (let i = 0; i < 40 && f.table.get('i1')?.reviewRequired !== true; i++) {
      await vi.advanceTimersByTimeAsync(150)
    }
    const row = f.table.get('i1')!
    expect(row.reviewRequired).toBe(true)
    expect(row.status).toBe('in_progress')
    // 4 条进度评论 + 2 个新拆子任务（不含预置的子任务行）+ 1 条 review 活动
    expect(f.comments.filter((c) => c.issueId === 'i1')).toHaveLength(4)
    const subs = [...f.table.values()].filter((i) => i.parentId === 'i1' && i.id !== 'sub-seed')
    expect(subs).toHaveLength(2)
    expect(subs.every((s) => s.assigneeId === 'agent-1')).toBe(true)
    // 预置子任务不被派发（无交付态、无进度评论）
    expect(f.table.get('sub-seed')?.reviewRequired).not.toBe(true)
    expect(f.activities.some((a) => a.type === 'review' && a.issueId === 'i1')).toBe(true)
    // 完成后 run 状态清空
    expect(sched.getRunsSnapshot().size).toBe(0)
    sched.dispose()
  })

  it('并发额度：3 个候选只同时跑 2 个，槽位空出后第三个补上', async () => {
    const f = makeFakeRepos([agentIssue('a'), agentIssue('b'), agentIssue('c')])
    const sched = createAgentScheduler({ repos: f.repos, agentIds: ['agent-1'], fast: true })
    f.emitAssigned('agent-1')

    // 第一拍：只应有 2 个在跑
    await vi.advanceTimersByTimeAsync(10)
    expect(sched.getRunsSnapshot().size).toBeLessThanOrEqual(2)

    // 全部推进完（3 条 run 串行复用槽位：2 + 1）
    for (let i = 0; i < 120 && f.table.get('c')?.reviewRequired !== true; i++) {
      await vi.advanceTimersByTimeAsync(150)
    }
    expect(f.table.get('a')?.reviewRequired).toBe(true)
    expect(f.table.get('b')?.reviewRequired).toBe(true)
    expect(f.table.get('c')?.reviewRequired).toBe(true)
    sched.dispose()
  })

  it('不重复派发：已在跑/已交付的 Issue 不会被 liveQuery 重播重启', async () => {
    const f = makeFakeRepos([agentIssue('i1')])
    const sched = createAgentScheduler({ repos: f.repos, agentIds: ['agent-1'], fast: true })
    // run 进行中多次重放同一批：绝不叠加第二条并行 run（交付后总评论数恒为 4）
    for (let i = 0; i < 60 && f.table.get('i1')?.reviewRequired !== true; i++) {
      f.emitAssigned('agent-1')
      await vi.advanceTimersByTimeAsync(150)
    }
    expect(f.table.get('i1')?.reviewRequired).toBe(true)
    expect(f.comments.filter((c) => c.issueId === 'i1')).toHaveLength(4)
    sched.dispose()
  })

  it('交付后驳回重做：清除待验收并改回 todo 会重新派发一轮完整 run', async () => {
    const f = makeFakeRepos([agentIssue('i1')])
    const sched = createAgentScheduler({ repos: f.repos, agentIds: ['agent-1'], fast: true })
    f.emitAssigned('agent-1')
    for (let i = 0; i < 40 && f.table.get('i1')?.reviewRequired !== true; i++) {
      await vi.advanceTimersByTimeAsync(150)
    }
    const firstRound = f.comments.filter((c) => c.issueId === 'i1').length
    expect(firstRound).toBe(4)

    // 人驳回：清待验收 + 退回 todo（与抽屉「驳回重做」按钮同写入）
    const row = f.table.get('i1')!
    row.reviewRequired = false
    row.status = 'todo'
    f.emitAssigned('agent-1')
    for (let i = 0; i < 40 && f.table.get('i1')?.reviewRequired !== true; i++) {
      await vi.advanceTimersByTimeAsync(150)
    }
    expect(f.table.get('i1')?.reviewRequired).toBe(true)
    expect(f.comments.filter((c) => c.issueId === 'i1').length).toBe(firstRound + 4)
    sched.dispose()
  })

  it('订阅快照：执行期间暴露步数，结束清空', async () => {
    const f = makeFakeRepos([agentIssue('i1')])
    const sched = createAgentScheduler({ repos: f.repos, agentIds: ['agent-1'], fast: true })
    const seen: number[] = []
    const unsub = sched.subscribeRuns(() => {
      seen.push(sched.getRunsSnapshot().size)
    })
    f.emitAssigned('agent-1')
    for (let i = 0; i < 40 && f.table.get('i1')?.reviewRequired !== true; i++) {
      await vi.advanceTimersByTimeAsync(150)
    }
    expect(sched.getRunsSnapshot().size).toBe(0)
    expect(seen.some((n) => n === 1)).toBe(true)
    unsub()
    sched.dispose()
  })
})
