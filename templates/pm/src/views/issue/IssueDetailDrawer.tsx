import { useState, useCallback, useRef, useEffect } from 'react'
import type { Issue, IssuePriority, IssueStatus, Member } from '@/types'
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from '@/types'
import {
  OSelect,
  OCheckbox,
  ODatePicker,
  OSegmented,
  OTimePicker,
  TagChip,
} from '@/components/oas-wrappers'
import { activityTypeLabel, dateLocale, relationLabel, statusLabel, t } from '@/i18n'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { useLabelSet } from '@/lib/labels'
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
              {a.field === '状态' && a.to ? ` → ${statusLabel(a.to)}` : ''}
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
  memberMap,
  currentUser,
  can,
}: {
  issueId: string
  memberMap: Map<string, Member>
  currentUser: string
  can: (action: Action, ctx?: Ctx) => boolean
}) {
  const { comments: commentsRepo, activities: activitiesRepo } = useRepositories()
  const comments = useObservable(() => commentsRepo.liveByIssue(issueId), [issueId, commentsRepo])
  const inputRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLElement & { value?: string }>(null)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const submit = async () => {
    const body = (inputRef.current?.value ?? '').trim()
    if (!body) return
    await commentsRepo.add({ issueId, authorId: currentUser, body })
    await activitiesRepo.log({ issueId, actorId: currentUser, type: 'comment' })
    if (inputRef.current) inputRef.current.value = ''
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

  return (
    <div className="comments-block" data-testid="comments-block">
      <span>
        {t('comments')}（{comments?.length ?? 0}）
      </span>
      <div className="comments-list">
        {(comments ?? []).map((cm) => (
          <div key={cm.id} data-testid="comment-item" style={{ position: 'relative' }}>
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
                <span slot="content">{renderMentions(cm.body)}</span>
                {cm.authorId === currentUser && (
                  <span slot="actions" className="comment-ops">
                    {can('comment:edit', { comment: cm }) && (
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
                    {can('comment:delete', { comment: cm }) && (
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
                )}
              </oas-comment>
            )}
          </div>
        ))}
      </div>
      {can('comment:create') && (
        <div className="comment-input-row">
          <input
            ref={inputRef}
            className="comment-input"
            data-testid="comment-input"
            placeholder={t('commentPlaceholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
}: {
  issueId: string
  memberMap: Map<string, Member>
  currentUser: string
  onClose: () => void
  can: (action: Action, ctx?: Ctx) => boolean
}) {
  const { issues: issuesRepo, activities: activitiesRepo } = useRepositories()
  const issue = useObservable(() => issuesRepo.live(issueId), [issueId, issuesRepo])
  const subs = useObservable(() => issuesRepo.liveSubIssues(issueId), [issueId, issuesRepo])
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
    if (!title || !issue) return
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
  }, [issue, currentUser, issuesRepo, activitiesRepo])

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
  useEffect(() => {
    if (issue?.labels?.includes('__none__')) {
      void issuesRepo.update(issue.id, {
        labels: issue.labels.filter((x) => x !== '__none__'),
      })
    }
  }, [issue?.id, issue?.labels, issuesRepo])

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
  // popconfirm 确认（reason='ok'）→ 删除并关抽屉
  useEffect(() => {
    const el = popRef.current
    if (!el) return
    const h = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
      if (reason === 'ok') void issuesRepo.delete(issueId).then(onClose)
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
  }, [issueId, onClose, issuesRepo])

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
  const canDelete = issue ? can('issue:delete', { issue }) : false

  useEffect(() => {
    descRefValue.current?.toggleAttribute('disabled', !canEdit)
  }, [canEdit])

  if (!issue) return <oas-drawer ref={drawerRef} />

  const relationTarget = (id: string) => relCandidates?.find((x) => x.id === id)
  const save = (changes: Partial<Issue>) => {
    if (issue && !can('issue:edit', { issue })) return
    // 脏数据兜底：历史版本曾把占位符 '__none__' 写进 labels，落库前清洗
    if (Array.isArray(changes.labels)) {
      const cleaned = changes.labels.filter((x) => x && x !== '__none__')
      if (cleaned.length !== changes.labels.length) changes.labels = cleaned
    }
    const FIELD_LABEL: Partial<Record<keyof Issue, string>> = {
      status: '状态',
      priority: '优先级',
      assigneeId: '负责人',
      description: '描述',
      title: '标题',
      dueAt: '截止日期',
      startAt: '开始日期',
    }
    const acts: Promise<unknown>[] = []
    for (const k of Object.keys(changes) as Array<keyof Issue>) {
      if (k === 'updatedAt' || !(k in FIELD_LABEL)) continue
      const to = String(changes[k] ?? '')
      const from = String(issue[k] ?? '')
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
              value={issue.status}
              options={ISSUE_STATUSES.map((s) => ({ label: statusLabel(s), value: s }))}
              onChange={(v) => save({ status: v as IssueStatus })}
              disabled={!canEdit}
            />
          </div>
          <div className="detail-field">
            <span>{t('priority')}</span>
            <OSelect
              testid="detail-priority"
              value={issue.priority}
              options={ISSUE_PRIORITIES.map((p) => ({ label: p, value: p }))}
              onChange={(v) => save({ priority: v as IssuePriority })}
              disabled={!canEdit}
            />
          </div>
          <div className="detail-field">
            <span>{t('assignee')}</span>
            <OSelect
              testid="detail-assignee"
              value={issue.assigneeId ?? '__none__'}
              options={memberOptions}
              onChange={(v) => save({ assigneeId: v === '__none__' ? null : v })}
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
                  onChange={() => {
                    const done = s.status === 'done'
                    void issuesRepo.update(s.id, {
                      status: done ? 'todo' : 'done',
                      completedAt: done ? null : Date.now(),
                      updatedAt: Date.now(),
                    })
                    void activitiesRepo.log({
                      issueId: s.id,
                      actorId: currentUser,
                      type: 'status',
                      field: '状态',
                      to: done ? 'todo' : 'done',
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
          {canEdit && (
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
            {issue.labels
              .filter((l) => l !== '__none__')
              .map((l) =>
                canEdit ? (
                  <TagChip
                    key={l}
                    label={l}
                    testid={`label-chip-${l}`}
                    onRemove={() => save({ labels: issue.labels.filter((x) => x !== l) })}
                  />
                ) : (
                  <oas-tag key={l}>{l}</oas-tag>
                ),
              )}
            {canEdit && (
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
            )}
          </div>
        </div>
        <CommentsBlock
          issueId={issue.id}
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
