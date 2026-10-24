import { useState, useCallback, useRef, useEffect } from 'react'
import type { Comment, Issue, IssuePriority, IssueStatus, Member } from '@/types'
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from '@/types'
import {
  OSelect,
  OCheckbox,
  ODatePicker,
  OSegmented,
  OTimePicker,
  TagChip,
} from '@/components/oas-wrappers'
import { activityTypeLabel, dateLocale, priorityLabel, relationLabel, statusLabel, t } from '@/i18n'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { useLabelSet } from '@/lib/labels'
import { loadCommentMode, storeCommentMode, type CommentMode } from '@/lib/preferences'
import {
  bucketOf,
  bucketToDueAt,
  clampStartAt,
  dueAtWithTime,
  hhmmOf,
  isBucketMoment,
  utcDay,
  type ScheduleBucket,
} from '@/lib/schedule-data'
import type { Action, Ctx } from '@/permission/policy'

/* ── 活动历史（详情抽屉） ── */
function DrawerActivities({
  issueId,
  memberMap,
}: {
  issueId: string
  memberMap: Map<string, Member>
}) {
  const { activities: activitiesRepo } = useRepositories()
  const acts = useObservable(() => activitiesRepo.liveByIssue(issueId), [issueId, activitiesRepo])
  return (
    <div className="activities-block" data-testid="activities-block">
      <span>
        {t('activities')}（{acts?.length ?? 0}）
      </span>
      <div className="activities-list">
        {(acts ?? []).map((a) => (
          <div key={a.id} className="activity-item" data-testid="activity-item">
            <span className="activity-actor">
              {memberMap.get(a.actorId)?.name ?? t('actorUnknown')}
            </span>
            <span className="activity-text">
              {activityTypeLabel(a.type)}
              {a.type === 'status' && a.to ? ` → ${statusLabel(a.to)}` : ''}
              {a.field && a.type !== 'status' && a.to ? ` → ${a.to}` : ''}
            </span>
            <span className="activity-time">
              {new Date(a.createdAt).toLocaleString(dateLocale())}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 评论区（详情抽屉，oas-comment + oas-input） ── */
function CommentsBlock({
  issueId,
  projectId,
  memberMap,
  currentUser,
  can,
}: {
  issueId: string
  projectId: string
  memberMap: Map<string, Member>
  currentUser: string
  can: (action: Action, ctx?: Ctx) => boolean
}) {
  const { comments: commentsRepo, activities: activitiesRepo } = useRepositories()
  const comments = useObservable(() => commentsRepo.liveByIssue(issueId), [issueId, commentsRepo])
  const inputRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLElement & { value?: string }>(null)
  const replyRef = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [mode, setMode] = useState<CommentMode>(() => loadCommentMode())
  const changeMode = (v: string) => {
    const next: CommentMode = v === 'flat' ? 'flat' : v === 'nested' ? 'nested' : 'thread'
    setMode(next)
    storeCommentMode(next)
  }

  const submit = async () => {
    const body = (inputRef.current?.value ?? '').trim()
    if (!body) return
    await commentsRepo.add({ issueId, authorId: currentUser, body })
    await activitiesRepo.log({ issueId, actorId: currentUser, type: 'comment' })
    if (inputRef.current) inputRef.current.value = ''
  }

  const submitReply = async (parentId: string) => {
    const body = (replyRef.current?.value ?? '').trim()
    if (!body) return
    await commentsRepo.add({ issueId, authorId: currentUser, body, parentId })
    await activitiesRepo.log({ issueId, actorId: currentUser, type: 'comment' })
    if (replyRef.current) replyRef.current.value = ''
    setReplyTo(null)
  }

  // 真实树：parentId 存直接父评论；无嵌套/一级/无限嵌套只是三种渲染模式
  const all = comments ?? []
  const byId = new Map(all.map((c) => [c.id, c]))
  const childrenOf = new Map<string | null, Comment[]>()
  for (const c of all) {
    const key = c.parentId ?? null
    const list = childrenOf.get(key) ?? []
    list.push(c)
    childrenOf.set(key, list)
  }
  const roots = childrenOf.get(null) ?? []
  /** 线程模式：根下的全部后代按时间平铺 */
  const descendants = (rootId: string): Comment[] => {
    const out: Comment[] = []
    const walk = (pid: string) => {
      for (const c of childrenOf.get(pid) ?? []) {
        out.push(c)
        walk(c.id)
      }
    }
    walk(rootId)
    return out.sort((a, b) => a.createdAt - b.createdAt)
  }
  const parentAuthorName = (cm: Comment): string => {
    const parent = cm.parentId ? byId.get(cm.parentId) : undefined
    return parent ? (memberMap.get(parent.authorId)?.name ?? t('commentAnonymous')) : ''
  }

  /** @提及渲染：@中文/英文名 → 高亮 span（纯文本安全拆分） */
  const renderMentions = (body: string) => {
    const parts = body.split(/(@[\u4e00-\u9fa5a-zA-Z0-9]+)/g)
    return parts.map((seg, i) =>
      seg.startsWith('@') ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: split 段与 body 一一对应、纯展示无重排增删，index key 稳定
        <span key={i} style={{ color: 'var(--oas-color-primary, #0b6cff)', fontWeight: 600 }}>
          {seg}
        </span>
      ) : (
        // biome-ignore lint/suspicious/noArrayIndexKey: split 段与 body 一一对应、纯展示无重排增删，index key 稳定
        <span key={i}>{seg}</span>
      ),
    )
  }

  /** 单条评论渲染。showReply：是否出现「回复」按钮；badge：无嵌套模式的「回复 @谁」标记 */
  const renderOne = (
    cm: Comment,
    opts: { isReply?: boolean; showReply?: boolean; badge?: boolean },
  ) => {
    const { isReply = false, showReply = false, badge = false } = opts
    return (
      <div
        key={cm.id}
        data-testid={isReply ? 'comment-reply-item' : 'comment-item'}
        style={{ position: 'relative' }}
      >
        {editingId === cm.id ? (
          <div className="comment-edit-row">
            <oas-textarea
              ref={editRef}
              data-testid="comment-edit"
              className="comment-input"
              style={{ minHeight: 60 }}
            />
            <div className="quit-actions">
              <oas-button
                size="small"
                data-testid="comment-cancel"
                onClick={() => setEditingId(null)}
              >
                {t('cancel')}
              </oas-button>
              <oas-button
                size="small"
                type="primary"
                data-testid="comment-save"
                onClick={() => {
                  const v = editRef.current?.value ?? ''
                  if (v.trim()) {
                    void commentsRepo.update(cm.id, v.trim())
                    void activitiesRepo.log({
                      issueId: cm.issueId,
                      actorId: currentUser,
                      type: 'comment-edit',
                    })
                  }
                  setEditingId(null)
                }}
              >
                {t('save')}
              </oas-button>
            </div>
          </div>
        ) : (
          <oas-comment
            author={memberMap.get(cm.authorId)?.name ?? t('commentAnonymous')}
            datetime={new Date(cm.createdAt).toLocaleString(dateLocale())}
          >
            <span slot="content">
              {badge && cm.parentId && (
                <span className="reply-tag">
                  ↳ {t('reply')} @{parentAuthorName(cm)}
                </span>
              )}
              {renderMentions(cm.body)}
            </span>
            <span slot="actions" className="comment-ops">
              {showReply && can('comment:create') && (
                <button
                  type="button"
                  className="comment-op"
                  data-testid="comment-reply"
                  onClick={() => setReplyTo(replyTo === cm.id ? null : cm.id)}
                >
                  {t('reply')}
                </button>
              )}
              {can('comment:edit', {
                comment: cm,
                issue: { assigneeId: null, reporterId: '', projectId },
              }) && (
                <button
                  type="button"
                  className="comment-op"
                  data-testid="comment-edit-btn"
                  onClick={() => {
                    setEditingId(cm.id)
                    setTimeout(() => {
                      if (editRef.current) editRef.current.value = cm.body
                    }, 50)
                  }}
                >
                  {t('adminEdit')}
                </button>
              )}
              {can('comment:delete', {
                comment: cm,
                issue: { assigneeId: null, reporterId: '', projectId },
              }) && (
                <button
                  type="button"
                  className="comment-op comment-op-del"
                  data-testid="comment-del"
                  onClick={() => void commentsRepo.delete(cm.id)}
                >
                  {t('delete')}
                </button>
              )}
            </span>
          </oas-comment>
        )}
        {replyTo === cm.id && can('comment:create') && (
          <div className="comment-reply-row" data-testid="comment-reply-row">
            <input
              ref={replyRef}
              className="comment-input"
              data-testid="reply-input"
              placeholder={t('replyPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitReply(cm.id)
              }}
            />
            <button
              className="comment-send"
              type="button"
              data-testid="reply-send"
              onClick={() => void submitReply(cm.id)}
            >
              {t('send')}
            </button>
            <button
              className="comment-op"
              type="button"
              data-testid="reply-cancel"
              onClick={() => setReplyTo(null)}
            >
              {t('cancel')}
            </button>
          </div>
        )}
      </div>
    )
  }

  /** 线程模式：根评论 + 全部后代按时间平铺在回复区（回复框由 renderOne 渲染在根评论上） */
  const renderThread = (root: Comment) => {
    const replies = descendants(root.id)
    return (
      <div key={root.id} data-testid="comment-item">
        {renderOne(root, { showReply: true })}
        {replies.length > 0 && (
          <div className="comment-replies" data-testid="comment-replies">
            <div className="replies-title">
              {t('replies')}（{replies.length}）
            </div>
            {replies.map((r) => renderOne(r, { isReply: true }))}
          </div>
        )}
      </div>
    )
  }

  /** 无限嵌套模式：逐层递归，每条都可回复 */
  const renderNested = (cm: Comment, depth: number) => {
    const children = (childrenOf.get(cm.id) ?? []).slice().sort((a, b) => a.createdAt - b.createdAt)
    return (
      <div key={cm.id} data-testid={depth === 0 ? 'comment-item' : undefined}>
        {renderOne(cm, { isReply: depth > 0, showReply: true })}
        {children.length > 0 && (
          <div
            className="comment-replies"
            data-testid={depth === 0 ? 'comment-replies' : undefined}
          >
            {children.map((c) => renderNested(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const sortedFlat = [...all].sort((a, b) => a.createdAt - b.createdAt)

  return (
    <div className="comments-block" data-testid="comments-block">
      <div className="comments-head">
        <span>
          {t('comments')}（{comments?.length ?? 0}）
        </span>
        <OSegmented
          testid="comment-mode"
          ariaLabel={t('commentModeLabel')}
          value={mode}
          options={[
            { label: t('modeFlat'), value: 'flat' },
            { label: t('modeThread'), value: 'thread' },
            { label: t('modeNested'), value: 'nested' },
          ]}
          onChange={changeMode}
        />
      </div>
      <div className="comments-list">
        {mode === 'flat'
          ? sortedFlat.map((cm) => renderOne(cm, { badge: true }))
          : mode === 'nested'
            ? roots.map((root) => renderNested(root, 0))
            : roots.map((root) => renderThread(root))}
      </div>
      {can('comment:create') && (
        <div className="comment-input-row">
          {/* 非受控：draft 只用于提交时读 DOM，受控 value 会在任何一次父级重渲染
              （如标签写库推回）时把用户/脚本刚填的内容清空 */}
          <input
            ref={inputRef}
            className="comment-input"
            data-testid="comment-input"
            placeholder={t('commentPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
          <button
            className="comment-send"
            type="button"
            data-testid="comment-send"
            onClick={() => void submit()}
          >
            {t('send')}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Issue 详情抽屉（oas-drawer + OSelect + oas-textarea + oas-tag + popconfirm，即时保存） ── */
export function IssueDetailDrawer({
  issueId,
  memberMap,
  currentUser,
  onClose,
  can,
  onDeleted,
}: {
  issueId: string
  memberMap: Map<string, Member>
  currentUser: string
  onClose: () => void
  can: (action: Action, ctx?: Ctx) => boolean
  /** 删除成功（软删除）：交给宿主弹「撤销」提示 */
  onDeleted?: (issue: Issue) => void
}) {
  const { issues: issuesRepo, activities: activitiesRepo, cycles: cyclesRepo } = useRepositories()
  const issue = useObservable(() => issuesRepo.live(issueId), [issueId, issuesRepo])
  const subs = useObservable(() => issuesRepo.liveSubIssues(issueId), [issueId, issuesRepo])
  // 迭代下拉只列本项目的周期（跨项目周期不可写）；issue 未加载时订阅空项目 id
  const projectCycles = useObservable(
    () => cyclesRepo.liveAll(issue?.projectId ?? ''),
    [issue?.projectId, cyclesRepo],
  )
  const labelSet = useLabelSet()
  const subInputRef = useRef<HTMLInputElement>(null)
  const [, setSelectedId] = useState<string | null>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const popRef = useRef<HTMLElement>(null)
  const [descDirty, setDescDirty] = useState(false)

  // 挂载即开（visible 属性；title 是 HTMLElement 全局 property，React 分派落不到 attribute）：
  // oas-drawer 会吸收 title attribute（titleCache 后 removeAttribute），issueKey 变化即重设
  const issueKey = issue?.key ?? ''
  useEffect(() => {
    const el = drawerRef.current
    if (!el) return
    el.setAttribute('visible', '')
    el.setAttribute('title', issueKey)
  }, [issueKey])

  const addSub = useCallback(async () => {
    const title = (subInputRef.current?.value ?? '').trim()
    if (!title || !issue || !can('issue:create')) return
    const created = await issuesRepo.create({
      projectId: issue.projectId,
      title,
      status: 'todo',
      priority: 'medium',
      assigneeId: issue.assigneeId,
      reporterId: currentUser,
      parentId: issue.id,
      order: issue.order,
    })
    if (subInputRef.current) subInputRef.current.value = ''
    await activitiesRepo.log({ issueId: created.id, actorId: currentUser, type: 'create' })
  }, [issue, currentUser, issuesRepo, activitiesRepo, can])

  // 标签编辑（oas-dynamic-tags）：modelValue 双向同步 issue.labels
  const labelsTagsRef = useRef<HTMLElement & { modelValue?: string[]; value?: string[] }>(null)
  // save 每次渲染重建（闭包捕获最新 issue/can），ref 承载避免轮询 timer 随渲染重挂
  const saveRef = useRef<(changes: Partial<Issue>) => void>(() => {})
  useEffect(() => {
    const el = labelsTagsRef.current
    if (!el) return
    el.modelValue = issue?.labels ?? []
  }, [issue?.labels])
  useEffect(() => {
    const el = labelsTagsRef.current
    if (!el) return
    // 添加派发 oas-add、删除/编辑走 writeBack——事件形态不一，轮询 modelValue 最可靠
    const timer = setInterval(() => {
      const v = (el as unknown as { modelValue?: string[] }).modelValue
      if (!Array.isArray(v)) return
      const cur = issue?.labels ?? []
      const cleaned = v.filter((x) => x && x !== '__none__')
      if (cleaned.length !== cur.length || cleaned.some((x, i) => x !== cur[i])) {
        saveRef.current({ labels: cleaned })
      }
    }, 400)
    return () => clearInterval(timer)
  }, [issue?.labels])

  // 描述编辑态在切换 issue 时重置；textarea value 跟随 issue.description
  const descRefValue = useRef<HTMLElement & { value?: string }>(null)
  // 历史脏数据清洗：labels 含 '__none__' 时落库修正
  // biome-ignore lint/correctness/useExhaustiveDependencies: 清洗 labels 时只关心 issue 与 repo，避免每次渲染重复写入
  useEffect(() => {
    if (issue?.labels?.includes('__none__') && can('issue:edit', { issue })) {
      void issuesRepo.update(issue.id, {
        labels: issue.labels.filter((x) => x !== '__none__'),
      })
    }
  }, [issue?.id, issue?.labels, issuesRepo, can])

  // biome-ignore lint/correctness/useExhaustiveDependencies: 切 issue 时即便 description 相同也必须重置脏态/textarea，防 A 的未保存编辑带进 B
  useEffect(() => {
    setDescDirty(false)
    if (descRefValue.current) descRefValue.current.value = issue?.description ?? ''
  }, [issueId, issue?.description])
  useEffect(() => {
    const el = descRefValue.current
    if (!el) return
    // 组件输入事件名不透明：轮询值对比驱动 dirty（500ms，编辑场景足够）
    const t = setInterval(() => {
      const cur = descRefValue.current?.value ?? ''
      setDescDirty(cur !== (issue?.description ?? ''))
    }, 500)
    return () => clearInterval(t)
  }, [issue?.description])
  // popconfirm 确认（reason='ok'）→ 软删除并关抽屉；宿主拿 key 弹「撤销」条
  const issueRef = useRef(issue)
  issueRef.current = issue
  const onDeletedRef = useRef(onDeleted)
  onDeletedRef.current = onDeleted
  // biome-ignore lint/correctness/useExhaustiveDependencies: issue?.id 是重挂触发器（首帧 issue 未到时抽屉走空渲染、popRef 为空，effect 体不引用它）
  useEffect(() => {
    const el = popRef.current
    if (!el) return
    const h = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
      if (reason !== 'ok') return
      void issuesRepo.delete(issueId).then(() => {
        const row = issueRef.current
        if (row) onDeletedRef.current?.(row)
        onClose()
      })
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
    // issue?.id 入依赖：首帧 issue 未到时抽屉走空渲染（popRef 为空），数据就绪后必须重挂监听
  }, [issueId, issue?.id, onClose, issuesRepo])

  // 关联选择 state：必须在早退之前（hooks 顺序恒定）
  const [relType, setRelType] = useState('__none__')
  // 「自定义」档瞬态：换档 custom 不写库（§3.1-1），仅靠此标记让 picker 先出现；
  // dueAt/切换 issue 变化即复位，稳态回显永远 = f(issue.dueAt)（无交互记忆）
  const [customSel, setCustomSel] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: 复位以 issueId/dueAt 变化为触发（effect 体不引用它们），同 descDirty 复位先例
  useEffect(() => {
    setCustomSel(false)
  }, [issueId, issue?.dueAt])
  const relCandidates = useObservable(
    () => issuesRepo.liveRelationCandidates(issue?.projectId ?? '', 100),
    [issueId, issuesRepo, issue?.projectId],
  )

  const canEdit = issue ? can('issue:edit', { issue }) : true
  const canChangeStatus = issue ? can('issue:change-status', { issue }) : false
  const canChangeAssignee = issue ? can('issue:change-assignee', { issue }) : false
  const canCreate = can('issue:create')
  const canDelete = issue ? can('issue:delete', { issue }) : false

  useEffect(() => {
    descRefValue.current?.toggleAttribute('disabled', !canEdit)
  }, [canEdit])

  if (!issue) return <oas-drawer ref={drawerRef} />

  const relationTarget = (id: string) => relCandidates?.find((x) => x.id === id)
  const save = (changes: Partial<Issue>) => {
    if (!issue) return
    // 细粒度权限：只改状态/负责人时，不要求完整 issue:edit
    const keys = Object.keys(changes) as Array<keyof Issue>
    const onlyStatus = keys.every((k) => k === 'status' || k === 'completedAt')
    const onlyAssignee = keys.every((k) => k === 'assigneeId')
    if (onlyStatus) {
      if (!canChangeStatus) return
    } else if (onlyAssignee) {
      if (!canChangeAssignee) return
    } else if (!canEdit) {
      return
    }
    // 脏数据兜底：历史版本曾把占位符 '__none__' 写进 labels，落库前清洗
    if (Array.isArray(changes.labels)) {
      const cleaned = changes.labels.filter((x) => x && x !== '__none__')
      if (cleaned.length !== changes.labels.length) changes.labels = cleaned
    }
    const FIELD_LABEL: Partial<Record<keyof Issue, string>> = {
      status: 'status',
      priority: 'priority',
      assigneeId: 'assigneeId',
      description: 'description',
      title: 'title',
      dueAt: 'dueAt',
      startAt: 'startAt',
      cycleId: 'cycleId',
    }
    // 迭代的活动记录写周期名而非 id：历史里出现 nanoid 对读者无意义
    const cycleName = (id: string | null | undefined) =>
      id == null ? '' : ((projectCycles ?? []).find((c) => c.id === id)?.name ?? id)
    const acts: Promise<unknown>[] = []
    for (const k of Object.keys(changes) as Array<keyof Issue>) {
      if (k === 'updatedAt' || !(k in FIELD_LABEL)) continue
      const to = k === 'cycleId' ? cycleName(changes.cycleId) : String(changes[k] ?? '')
      const from = k === 'cycleId' ? cycleName(issue.cycleId) : String(issue[k] ?? '')
      if (from === to) continue
      acts.push(
        activitiesRepo.log({
          issueId: issue.id,
          actorId: currentUser,
          type: k as string,
          field: FIELD_LABEL[k],
          from,
          to,
        }),
      )
      if (k === 'status') changes.completedAt = to === 'done' ? Date.now() : null
    }
    Promise.all(acts)
      .then(() => issuesRepo.update(issue.id, changes))
      .catch((e) => console.error('[save acts]', (e as Error)?.message ?? e))
  }
  saveRef.current = save
  const memberOptions = [
    { label: t('resourceUnassigned'), value: '__none__' },
    ...[...memberMap.values()].map((m) => ({ label: m.name, value: m.id })),
  ]
  const cycleOptions = [
    { label: t('noCycle'), value: '__none__' },
    ...(projectCycles ?? []).map((c) => ({ label: c.name, value: c.id })),
  ]
  // 回显 = f(issue.dueAt)：恰为桶时刻（UTC 00/09/14）亮对应档，否则亮自定义（§3.1-1，
  // 精度必须可见）；customSel 仅覆盖「点了自定义尚未写库」的瞬态窗口
  const derivedBucket: ScheduleBucket | 'custom' =
    issue.dueAt === null ? 'allday' : isBucketMoment(issue.dueAt) ? bucketOf(issue.dueAt) : 'custom'
  const dueBucket = customSel && derivedBucket !== 'custom' ? 'custom' : derivedBucket
  const showTimePicker = issue.dueAt !== null && dueBucket === 'custom'

  return (
    <oas-drawer ref={drawerRef} no-footer data-testid="detail-drawer">
      <div className="detail-body">
        <h2 className="detail-title">{issue.title}</h2>
        <div className="detail-meta">
          <div className="detail-field">
            <span>{t('status')}</span>
            <OSelect
              testid="detail-status"
              ariaLabel={t('status')}
              value={issue.status}
              options={ISSUE_STATUSES.map((s) => ({ label: statusLabel(s), value: s }))}
              onChange={(v) => save({ status: v as IssueStatus })}
              disabled={!canChangeStatus}
            />
          </div>
          <div className="detail-field">
            <span>{t('priority')}</span>
            <OSelect
              testid="detail-priority"
              ariaLabel={t('priority')}
              value={issue.priority}
              options={ISSUE_PRIORITIES.map((p) => ({ label: priorityLabel(p), value: p }))}
              onChange={(v) => save({ priority: v as IssuePriority })}
              disabled={!canEdit}
            />
          </div>
          <div className="detail-field">
            <span>{t('assignee')}</span>
            <OSelect
              testid="detail-assignee"
              ariaLabel={t('assignee')}
              value={issue.assigneeId ?? '__none__'}
              options={memberOptions}
              onChange={(v) => save({ assigneeId: v === '__none__' ? null : v })}
              disabled={!canChangeAssignee}
            />
          </div>
          <div className="detail-field">
            <span>{t('cycle')}</span>
            <OSelect
              testid="detail-cycle"
              ariaLabel={t('cycle')}
              value={issue.cycleId ?? '__none__'}
              options={cycleOptions}
              onChange={(v) => save({ cycleId: v === '__none__' ? null : v })}
              disabled={!canEdit}
            />
          </div>
          <div className="detail-field">
            <span>{t('dueDate')}</span>
            <ODatePicker
              testid="detail-due-date"
              value={issue.dueAt === null ? '' : utcDay(issue.dueAt)}
              disabled={!canEdit}
              onChange={(v) => {
                // 清日期 → dueAt/startAt 一并置空（不留悬挂 startAt；档位回落全天）；
                // 选日期保留原时刻（§3.1-3：桶时刻与精确时刻一视同仁），倒挂 startAt 钳制
                if (v === '') {
                  save({ dueAt: null, startAt: null })
                  return
                }
                const dueAt =
                  issue.dueAt === null
                    ? dueAtWithTime(v, 0, 0)
                    : dueAtWithTime(
                        v,
                        new Date(issue.dueAt).getUTCHours(),
                        new Date(issue.dueAt).getUTCMinutes(),
                      )
                const startAt = clampStartAt(issue.startAt, dueAt)
                save(startAt !== issue.startAt ? { dueAt, startAt } : { dueAt })
              }}
            />
            <OSegmented
              testid="detail-due-bucket"
              value={dueBucket}
              options={[
                { label: t('bucketAllday'), value: 'allday' },
                { label: t('bucketAm'), value: 'am' },
                { label: t('bucketPm'), value: 'pm' },
                { label: t('bucketCustom'), value: 'custom' },
              ]}
              disabled={!canEdit || issue.dueAt === null}
              onChange={(b) => {
                if (issue.dueAt === null) return
                // 换档 custom 不写库（§3.1-1）：picker 带当前时刻出现，oas-change 才落库；
                // customSel 只覆盖「已点 custom 尚未写库」窗口，写库后由回显推导接管
                if (b === 'custom') {
                  setCustomSel(true)
                  return
                }
                setCustomSel(false)
                const dueAt = bucketToDueAt(utcDay(issue.dueAt), b as ScheduleBucket)
                const startAt = clampStartAt(issue.startAt, dueAt)
                save(startAt !== issue.startAt ? { dueAt, startAt } : { dueAt })
              }}
            />
            {showTimePicker && (
              <OTimePicker
                testid="detail-due-time"
                value={issue.dueAt === null ? '' : hhmmOf(issue.dueAt)}
                presets={[
                  { label: t('bucketAm'), value: '09:00' },
                  { label: t('bucketPm'), value: '14:00' },
                ]}
                disabled={!canEdit}
                onChange={(v) => {
                  if (issue.dueAt === null || v === '') return
                  // 手拆 'HH:mm'（禁隐式解析）；点 preset 09:00/14:00 → 写桶时刻 →
                  // 回显规则使 segmented 跳回对应桶、picker 收起（§3.1-1 有意接受）
                  const [hh, mm] = v.split(':').map(Number)
                  const dueAt = dueAtWithTime(utcDay(issue.dueAt), hh ?? 0, mm ?? 0)
                  const startAt = clampStartAt(issue.startAt, dueAt)
                  save(startAt !== issue.startAt ? { dueAt, startAt } : { dueAt })
                }}
              />
            )}
          </div>
        </div>
        <div className="detail-subs-block">
          <span>
            {t('subtasks')}（{subs?.length ?? 0}）
          </span>
          <div className="subs-list">
            {(subs ?? []).map((s) => (
              <div key={s.id} className="sub-item" data-testid="sub-item">
                <OCheckbox
                  className="row-check"
                  testid="row-check"
                  checked={s.status === 'done'}
                  disabled={!can('issue:change-status', { issue: s })}
                  onChange={async () => {
                    const done = s.status === 'done'
                    // 先写活动再改状态：通知生成读取「当前 issue」作为 from，顺序反了会丢状态通知
                    await activitiesRepo.log({
                      issueId: s.id,
                      actorId: currentUser,
                      type: 'status',
                      field: '状态',
                      to: done ? 'todo' : 'done',
                    })
                    await issuesRepo.update(s.id, {
                      status: done ? 'todo' : 'done',
                      completedAt: done ? null : Date.now(),
                      updatedAt: Date.now(),
                    })
                  }}
                />
                {/* biome-ignore lint/a11y/useSemanticElements: 行内项与多选框/标签并列、样式契约为 span，不换 <button> */}
                <span
                  className={`issue-title${s.status === 'done' ? ' sub-done' : ''}`}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedId(s.id)
                  }}
                >
                  {s.key} {s.title}
                </span>
                <oas-tag size="small" type={s.status === 'done' ? 'success' : 'info'}>
                  {statusLabel(s.status)}
                </oas-tag>
              </div>
            ))}
          </div>
          {canCreate && (
            <div className="sub-add-row">
              <input
                ref={subInputRef}
                className="comment-input"
                data-testid="sub-add-input"
                placeholder={t('subPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addSub()
                }}
              />
              <oas-button size="small" data-testid="sub-add" onClick={() => void addSub()}>
                {t('addSub')}
              </oas-button>
            </div>
          )}
        </div>
        <div className="detail-desc-block">
          <span>{t('description')}</span>
          <oas-textarea
            ref={descRefValue}
            data-testid="detail-desc"
            placeholder={t('descPlaceholder')}
            className="detail-textarea"
          />
          {descDirty && canEdit && (
            <button
              className="detail-save-desc"
              type="button"
              data-testid="detail-desc-save"
              onClick={() => {
                save({ description: descRefValue.current?.value ?? '' })
                setDescDirty(false)
              }}
            >
              {t('descSave')}
            </button>
          )}
        </div>
        <div className="detail-relations-block">
          <span>{t('relations')}</span>
          <div className="detail-labels">
            {(issue.relations ?? []).map((r, i) => {
              const target = relationTarget(r.targetId)
              const relLabel = `${relationLabel(r.type)} ${target?.key ?? r.targetId.slice(0, 10)}`
              return canEdit ? (
                <TagChip
                  key={`${r.type}-${r.targetId}`}
                  label={relLabel}
                  testid={`relation-chip-${i}`}
                  onRemove={() => {
                    const next = (issue.relations ?? []).filter((_, j) => j !== i)
                    save({ relations: next })
                    void activitiesRepo.log({
                      issueId: issue.id,
                      actorId: currentUser,
                      type: 'relations',
                      field: '关联',
                      to: `${r.type} ${target?.key ?? r.targetId}`,
                    })
                  }}
                />
              ) : (
                <oas-tag key={`${r.type}-${r.targetId}`}>{relLabel}</oas-tag>
              )
            })}
            {canEdit && (
              <OSelect
                testid="relation-add-type"
                ariaLabel={t('relAdd')}
                value={relType}
                options={[
                  { label: t('relAdd'), value: '__none__' },
                  { label: t('relOptBlocks'), value: 'blocks' },
                  { label: t('relOptBlockedBy'), value: 'blocked-by' },
                  { label: t('relOptRelates'), value: 'relates' },
                ]}
                onChange={setRelType}
              />
            )}
            {canEdit && relType !== '__none__' && (
              <OSelect
                testid="relation-add-target"
                ariaLabel={t('relPickIssue')}
                value="__none__"
                options={[
                  { label: t('relPickIssue'), value: '__none__' },
                  ...(relCandidates ?? []).map((x) => ({
                    label: `${x.key} ${x.title.slice(0, 14)}`,
                    value: x.id,
                  })),
                ]}
                onChange={(tid) => {
                  if (tid === '__none__') return
                  const next = [
                    ...(issue.relations ?? []),
                    { type: relType as 'blocks', targetId: tid },
                  ]
                  save({ relations: next })
                  setRelType('__none__')
                  void activitiesRepo.log({
                    issueId: issue.id,
                    actorId: currentUser,
                    type: 'relations',
                    field: '关联',
                    to: `${relType} ${tid}`,
                  })
                }}
              />
            )}
          </div>
        </div>
        <div className="detail-labels-block">
          <span>{t('labels')}</span>
          <div className="detail-labels">
            {canEdit ? (
              <>
                <oas-dynamic-tags
                  data-testid="label-add"
                  ref={labelsTagsRef}
                  placeholder={t('adminCfgLabelsPlaceholder')}
                  style={{ width: '100%' }}
                />
                <div className="label-quick" data-testid="label-quick">
                  {labelSet
                    .filter((l) => !issue.labels.includes(l))
                    .map((l) => (
                      <button
                        key={l}
                        type="button"
                        className="label-quick-btn"
                        data-testid={`label-quick-${l}`}
                        onClick={() => {
                          if (l !== '__none__' && !issue.labels.includes(l))
                            save({ labels: [...issue.labels.filter((x) => x !== '__none__'), l] })
                        }}
                      >
                        + {l}
                      </button>
                    ))}
                </div>
              </>
            ) : (
              issue.labels
                .filter((l) => l !== '__none__')
                .map((l) => <oas-tag key={l}>{l}</oas-tag>)
            )}
          </div>
        </div>
        <CommentsBlock
          issueId={issue.id}
          projectId={issue.projectId}
          memberMap={memberMap}
          currentUser={currentUser}
          can={can}
        />
        <DrawerActivities issueId={issue.id} memberMap={memberMap} />
        <div className="detail-foot">
          <span className="detail-dates">
            {t('detailDates')
              .replace('{created}', new Date(issue.createdAt).toLocaleDateString(dateLocale()))
              .replace('{updated}', new Date(issue.updatedAt).toLocaleString(dateLocale()))}
          </span>
          <oas-popconfirm ref={popRef} title={t('adminDeleteConfirm')} data-testid="detail-delete">
            {canDelete && (
              <oas-button type="danger" data-testid="detail-delete-btn">
                {t('delete')}
              </oas-button>
            )}
          </oas-popconfirm>
        </div>
      </div>
    </oas-drawer>
  )
}
