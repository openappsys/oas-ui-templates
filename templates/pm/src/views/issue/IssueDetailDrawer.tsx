import { useState, useCallback, useRef, useEffect } from 'react'
import type { Issue, IssuePriority, IssueStatus, Member } from '@/types'
import { ISSUE_PRIORITIES, ISSUE_STATUSES, STATUS_LABEL } from '@/types'
import { OSelect, TagChip } from '@/components/oas-wrappers'
import { t } from '@/i18n'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
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
  const TYPE_LABEL: Record<string, string> = {
    create: '创建了 Issue',
    status: '变更了状态',
    priority: '变更了优先级',
    assignee: '变更了负责人',
    labels: '更新了标签',
    description: '更新了描述',
    title: '更新了标题',
    dates: '调整了排期',
  }
  return (
    <div className="activities-block" data-testid="activities-block">
      <span>
        {t('activities')}（{acts?.length ?? 0}）
      </span>
      <div className="activities-list">
        {(acts ?? []).map((a) => (
          <div key={a.id} className="activity-item" data-testid="activity-item">
            <span className="activity-actor">{memberMap.get(a.actorId)?.name ?? '某人'}</span>
            <span className="activity-text">
              {TYPE_LABEL[a.type] ?? a.type}
              {a.field === '状态' && a.to ? ` → ${STATUS_LABEL[a.to as IssueStatus] ?? a.to}` : ''}
              {a.field && a.type !== 'status' && a.to ? ` → ${a.to}` : ''}
            </span>
            <span className="activity-time">{new Date(a.createdAt).toLocaleString()}</span>
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
        <span key={i} style={{ color: '#0b6cff', fontWeight: 600 }}>
          {seg}
        </span>
      ) : (
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
                    取消
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
                    保存
                  </oas-button>
                </div>
              </div>
            ) : (
              <oas-comment
                author={memberMap.get(cm.authorId)?.name ?? '匿名'}
                datetime={new Date(cm.createdAt).toLocaleString()}
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
                        编辑
                      </button>
                    )}
                    {can('comment:delete', { comment: cm }) && (
                      <button
                        type="button"
                        className="comment-op comment-op-del"
                        data-testid="comment-del"
                        onClick={() => void commentsRepo.delete(cm.id)}
                      >
                        删除
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
const RELATION_LABEL: Record<string, string> = {
  blocks: '阻塞',
  'blocked-by': '被阻塞',
  relates: '相关',
}
const LABELS = ['frontend', 'backend', 'design', 'bug', 'feature', 'tech-debt', 'docs', 'infra']

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
  const subInputRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const popRef = useRef<HTMLElement>(null)
  const [descDirty, setDescDirty] = useState(false)

  useEffect(() => {
    const el = drawerRef.current
    if (!el) return
    // 挂载即开（visible 属性；title 是 HTMLElement 全局 property，React 分派落不到 attribute）
    el.setAttribute('visible', '')
    el.setAttribute('title', issue ? issue.key : '')
  }, [issue?.id])
  useEffect(() => {
    drawerRef.current?.setAttribute('title', issue ? issue.key : '')
  }, [issue?.key])

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
  useEffect(() => {
    const el = labelsTagsRef.current
    if (!el) return
    el.modelValue = issue?.labels ?? []
  }, [issue?.labels, issueId])
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
        save({ labels: cleaned })
      }
    }, 400)
    return () => clearInterval(timer)
  }, [issueId, issue?.labels])

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
  }, [issueId, issue?.description])
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
  const memberOptions = [
    { label: '未分配', value: '__none__' },
    ...[...memberMap.values()].map((m) => ({ label: m.name, value: m.id })),
  ]

  return (
    <oas-drawer ref={drawerRef} no-footer data-testid="detail-drawer">
      <div className="detail-body">
        <h2 className="detail-title">{issue.title}</h2>
        <div className="detail-meta">
          <div className="detail-field">
            <span>状态</span>
            <OSelect
              testid="detail-status"
              value={issue.status}
              options={ISSUE_STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s }))}
              onChange={(v) => save({ status: v as IssueStatus })}
              disabled={!canEdit}
            />
          </div>
          <div className="detail-field">
            <span>优先级</span>
            <OSelect
              testid="detail-priority"
              value={issue.priority}
              options={ISSUE_PRIORITIES.map((p) => ({ label: p, value: p }))}
              onChange={(v) => save({ priority: v as IssuePriority })}
              disabled={!canEdit}
            />
          </div>
          <div className="detail-field">
            <span>负责人</span>
            <OSelect
              testid="detail-assignee"
              value={issue.assigneeId ?? '__none__'}
              options={memberOptions}
              onChange={(v) => save({ assigneeId: v === '__none__' ? null : v })}
              disabled={!canEdit}
            />
          </div>
        </div>
        <div className="detail-subs-block">
          <span>
            {t('subtasks')}（{subs?.length ?? 0}）
          </span>
          <div className="subs-list">
            {(subs ?? []).map((s) => (
              <div key={s.id} className="sub-item" data-testid="sub-item">
                <input
                  type="checkbox"
                  className="row-check"
                  checked={s.status === 'done'}
                  disabled={!can('issue:change-status', { issue: s })}
                  onClick={(e) => {
                    e.stopPropagation()
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
                  readOnly
                />
                <span
                  className={`issue-title${s.status === 'done' ? ' sub-done' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedId(s.id)}
                >
                  {s.key} {s.title}
                </span>
                <oas-tag size="small" type={s.status === 'done' ? 'success' : 'info'}>
                  {STATUS_LABEL[s.status]}
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
                placeholder="新子任务标题…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addSub()
                }}
              />
              <oas-button size="small" data-testid="sub-add" onClick={() => void addSub()}>
                添加
              </oas-button>
            </div>
          )}
        </div>
        <div className="detail-desc-block">
          <span>{t('description')}</span>
          <oas-textarea
            ref={descRefValue}
            data-testid="detail-desc"
            placeholder="Description…"
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
              保存描述
            </button>
          )}
        </div>
        <div className="detail-relations-block">
          <span>{t('relations')}</span>
          <div className="detail-labels">
            {(issue.relations ?? []).map((r, i) => {
              const target = relationTarget(r.targetId)
              const relLabel = `${RELATION_LABEL[r.type] ?? r.type} ${target?.key ?? r.targetId.slice(0, 10)}`
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
                  { label: '关联…', value: '__none__' },
                  { label: 'blocks（阻塞）', value: 'blocks' },
                  { label: 'blocked-by（被阻塞）', value: 'blocked-by' },
                  { label: 'relates（相关）', value: 'relates' },
                ]}
                onChange={setRelType}
              />
            )}
            {canEdit && relType !== '__none__' && (
              <OSelect
                testid="relation-add-target"
                value="__none__"
                options={[
                  { label: '选择 Issue…', value: '__none__' },
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
                  placeholder="＋ 输入标签后回车"
                  style={{ width: '100%' }}
                />
                <div className="label-quick" data-testid="label-quick">
                  {LABELS.filter((l) => !issue.labels.includes(l)).map((l) => (
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
            创建 {new Date(issue.createdAt).toLocaleDateString()} · 更新{' '}
            {new Date(issue.updatedAt).toLocaleString()}
          </span>
          <oas-popconfirm ref={popRef} title="删除后不可恢复，确认？" data-testid="detail-delete">
            {canDelete && (
              <oas-button type="danger" data-testid="detail-delete-btn">
                删除
              </oas-button>
            )}
          </oas-popconfirm>
        </div>
      </div>
    </oas-drawer>
  )
}
