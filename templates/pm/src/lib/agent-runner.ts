import type { Repositories } from '@/data/types'
import type { Issue } from '@/types'

/**
 * Agent 调度器：把指派给 agent 成员的 Issue 走一遍「模拟执行」流水线——
 * 接单分析 → 拆解子任务 → 实现推进 → 交付待验收（reviewRequired）。
 *
 * 设计取自 Linear Agents / GitHub Copilot agent 的共同形态：
 * - agent 是指派目标：分配即派发，无需单独「运行」入口
 * - 进度走既有评论/活动流（人机同构，不另开频道）
 * - 人类保留验收门：agent 停在 reviewRequired，done 只能由人触发
 * - 已接单的 run 会完成（改派不召回，人用「驳回」表达重做）
 *
 * 工程约束：
 * - 纯客户端模块，跑在仓库层之上（Dexie/API 两种数据源共用；通知由各自写入路径产生）
 * - 实例化设计（createAgentScheduler）：状态在闭包里，测试可隔离；App 用单例门面
 * - 并发上限（MAX_CONCURRENT）体现「额度」语义，超出的排队
 * - 页面刷新会重启未完成 run（演示语义可接受；e2e 用 fast 档秒级完成，几乎不跨刷新）
 * - e2e 提速：fast 档步进 ~150ms（正常 ~2.2s，一条 run 约 7s）
 */

/** 单个 Issue 的执行进度（抽屉「agent 工作中」指示条消费） */
export interface AgentRunState {
  issueId: string
  agentId: string
  /** 已完成步数（1 起） */
  step: number
  /** 总步数 */
  total: number
}

type Listener = () => void

const STEP_TOTAL = 4
/** 并发额度：同时执行的 agent run 上限，超出的排队（体现「额度/范围限制」语义） */
const MAX_CONCURRENT = 2

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface AgentScheduler {
  dispose: () => void
  /** 订阅 run 状态快照（抽屉指示条 / 测试断言） */
  subscribeRuns: (listener: Listener) => () => void
  /** useSyncExternalStore 的 getSnapshot：引用稳定（仅在 run 状态变化时更换） */
  getRunsSnapshot: () => Map<string, AgentRunState>
}

/** 依次执行 run 步骤；返回是否完整跑完（中途 Issue 消失/被改则中止） */
async function executeRun(ctx: SchedulerCtx, issue: Issue, agentId: string): Promise<boolean> {
  const { repos } = ctx
  const delay = ctx.fast ? 150 : 2200
  const next = (step: number) => {
    const s = ctx.state.runs.get(issue.id)
    ctx.state.runs.set(issue.id, {
      issueId: issue.id,
      agentId,
      step,
      total: STEP_TOTAL,
    })
    if (!s || s.step !== step) ctx.publish()
  }

  // 重新读取最新行：调度触发到执行之间 Issue 可能已被改
  const fresh = await repos.issues.get(issue.id)
  if (!fresh || fresh.deletedAt || fresh.assigneeId !== agentId) return false
  if (fresh.reviewRequired || fresh.status === 'done' || fresh.status === 'cancelled') return false

  // 步骤 1：接单分析 → in_progress
  next(1)
  await repos.comments.add({
    issueId: issue.id,
    authorId: agentId,
    body: '🔎 已接单：分析需求描述与验收标准，拆解执行计划。',
  })
  if (fresh.status !== 'in_progress') {
    await repos.issues.update(issue.id, { status: 'in_progress' })
    await repos.activities.log({
      issueId: issue.id,
      actorId: agentId,
      type: 'status',
      field: 'status',
      from: fresh.status,
      to: 'in_progress',
    })
  }
  await sleep(delay)

  // 步骤 2：拆解子任务（真实 Issue：走 key 分配，父子的完成度联动看板进度条）
  next(2)
  const subs = [`${fresh.title}——实现`, `${fresh.title}——验证`]
  for (const title of subs) {
    await repos.issues.create({
      projectId: fresh.projectId,
      title,
      description: `由 agent 自动拆解（父 Issue：${fresh.key}）`,
      status: 'todo',
      priority: fresh.priority,
      assigneeId: agentId,
      reporterId: fresh.reporterId,
      parentId: fresh.id,
    })
  }
  await repos.comments.add({
    issueId: issue.id,
    authorId: agentId,
    body: `🧩 拆解出 ${subs.length} 个子任务（实现 / 验证），已挂到本 Issue 下。`,
  })
  await sleep(delay)

  // 步骤 3：实现推进
  next(3)
  await repos.comments.add({
    issueId: issue.id,
    authorId: agentId,
    body: '⚙️ 实现完成，正在补测试与自查（模拟执行，非真实代码变更）。',
  })
  await sleep(delay)

  // 步骤 4：交付 → 待验收（人审门：done 只能由人触发）
  next(4)
  await repos.comments.add({
    issueId: issue.id,
    authorId: agentId,
    body: '✅ 交付完成：模拟 PR #1024 已附（实现 + 测试通过）。请人工验收；通过后可关闭本 Issue。',
  })
  await repos.activities.log({
    issueId: issue.id,
    actorId: agentId,
    type: 'review',
    field: 'reviewRequired',
    to: 'pending',
  })
  await repos.issues.update(issue.id, { reviewRequired: true })
  return true
}

interface SchedulerCtx {
  repos: Repositories
  fast: boolean
  state: Store
  publish: () => void
}

/** 调度器状态存储：App 传模块级单例（UI 订阅同一份）；测试各自新建实现隔离 */
interface Store {
  runs: Map<string, AgentRunState>
  listeners: Set<Listener>
  snapshot: Map<string, AgentRunState>
  waiting: Set<string>
}

/**
 * 创建一个独立的调度器实例（状态闭包隔离，测试互不污染）。
 * 返回 dispose（清空定时与状态；数据层写入不可撤销——中断的 run 停在当前步）。
 */
export function createAgentScheduler(opts: {
  repos: Repositories
  agentIds: string[]
  fast?: boolean
  store?: Store
}): AgentScheduler {
  const store: Store = opts.store ?? {
    runs: new Map<string, AgentRunState>(),
    listeners: new Set<Listener>(),
    snapshot: new Map<string, AgentRunState>(),
    waiting: new Set<string>(),
  }
  const publish = () => {
    store.snapshot = new Map(store.runs)
    for (const l of store.listeners) l()
  }
  const ctx: SchedulerCtx = {
    repos: opts.repos,
    fast: opts.fast === true,
    state: store,
    publish,
  }
  const running = new Map<string, Promise<unknown>>()
  let alive = true
  /** 最新一拍的候选（每轮 emit 全量替换；drain 只看这里，不持有旧数组） */
  let latestCandidates: Issue[] = []

  async function drain(): Promise<void> {
    for (const stale of latestCandidates) {
      // waiting 同步入集：microtask 里才进 running，本循环内必须用 waiting+running 判额度
      if (running.size + store.waiting.size >= MAX_CONCURRENT) return
      if (running.has(stale.id) || store.waiting.has(stale.id)) continue
      // 快照会过期：派发前重读最新行（交付/关闭/改派的候选在这里自然出局），
      // 否则完成的 run 会被过期快照无限重启（微任务永不排空，假时钟直接卡死）
      const fresh = await opts.repos.issues.get(stale.id)
      if (
        !fresh ||
        fresh.deletedAt ||
        fresh.reviewRequired === true ||
        fresh.status === 'done' ||
        fresh.status === 'cancelled'
      ) {
        continue
      }
      const agentId = fresh.assigneeId ?? ''
      if (!agentId) continue
      store.waiting.add(fresh.id)
      // 微任务延迟启动：让 liveQuery 回调先结束，避免与订阅更新重入
      void Promise.resolve().then(() => {
        store.waiting.delete(fresh.id)
        const p = executeRun(ctx, fresh, agentId)
          .then((done) => {
            if (!done) finishRun(fresh.id)
            return done
          })
          .catch(() => finishRun(fresh.id))
          .finally(() => {
            running.delete(fresh.id)
            finishRun(fresh.id)
            // 槽位空出：按最新候选重喂（重新判定并发与状态）
            void drain()
          })
        running.set(fresh.id, p)
      })
    }
  }

  function finishRun(issueId: string): void {
    store.runs.delete(issueId)
    publish()
  }

  const unsub = opts.repos.issues.liveAssignedTo(opts.agentIds).subscribe({
    next(issues) {
      if (!alive) return
      latestCandidates = issues.filter(
        (i) =>
          i.status !== 'done' &&
          i.status !== 'cancelled' &&
          i.reviewRequired !== true &&
          i.assigneeId != null &&
          // 只跑顶层 Issue：agent 自己拆出的子任务不再递归派发（否则指数增长）
          i.parentId == null,
      )
      void drain()
    },
  })

  return {
    dispose: () => {
      alive = false
      unsub()
      running.clear()
      store.waiting.clear()
      store.runs.clear()
      publish()
    },
    subscribeRuns: (listener) => {
      store.listeners.add(listener)
      return () => {
        store.listeners.delete(listener)
      }
    },
    getRunsSnapshot: () => store.snapshot,
  }
}

/* ── App 单例门面：全应用一个调度器，其 run 状态挂模块级 store 供 UI 订阅 ── */
const appStore: Store = {
  runs: new Map(),
  listeners: new Set(),
  snapshot: new Map(),
  waiting: new Set(),
}

export function subscribeAgentRuns(listener: Listener): () => void {
  appStore.listeners.add(listener)
  return () => {
    appStore.listeners.delete(listener)
  }
}

/** useSyncExternalStore 的 getSnapshot：引用稳定（仅在 run 状态变化时更换） */
export function getAgentRunsSnapshot(): Map<string, AgentRunState> {
  return appStore.snapshot
}

export function startAgentScheduler(opts: {
  repos: Repositories
  agentIds: string[]
  fast?: boolean
}): () => void {
  return createAgentScheduler({ ...opts, store: appStore }).dispose
}
