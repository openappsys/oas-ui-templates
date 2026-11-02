import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { t, priorityLabel } from '@/i18n'
import { ISSUE_PRIORITIES, type WorkflowState, type Project } from '@/types'
import { AVATAR_PALETTE } from '@/lib/colors'
import { DEFAULT_LABELS } from '@/lib/labels'
import type { AdminTab } from './AdminView'

/** 类别语义：行为判定（done 判定/进度派生/迁移保护）都锚定类别而非具体状态 */
const CATEGORY_KEYS = ['todo', 'started', 'done', 'cancelled'] as const
const CATEGORY_LABEL: Record<WorkflowState['category'], string> = {
  todo: t('wf.cat.todo'),
  started: t('wf.cat.started'),
  done: t('wf.cat.done'),
  cancelled: t('wf.cat.cancelled'),
}
/** 新建状态的建议色（按类别缺省，可改选） */
const CATEGORY_COLOR: Record<WorkflowState['category'], string> = {
  todo: '#94a3b8',
  started: '#0b6cff',
  done: '#16a34a',
  cancelled: '#94a3b8',
}

const PRIORITY_TAG_TYPE: Record<string, string> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
}

type Col = {
  key: string
  title: string
  align?: 'left' | 'center' | 'right'
  render?: (row: Record<string, unknown>) => string | Node
}
type TableHost = HTMLElement & {
  columns?: Col[]
  data?: Array<Record<string, unknown>>
}

export function ConfigTab({ onNav }: { onNav?: (tab: AdminTab) => void }) {
  return (
    <div className="admin-crud-page" data-testid="admin-tab-config">
      <h1 className="page-h1">{t('adminConfigTitle')}</h1>
      <WorkflowPanel />
      <LabelPanel />
      <ReadOnlyTags
        testid="admin-config-priorities"
        title={t('priority')}
        tags={ISSUE_PRIORITIES.map((p) => ({
          key: p,
          label: priorityLabel(p),
          type: PRIORITY_TAG_TYPE[p],
        }))}
      />
      <div className="admin-panel" data-testid="admin-config-statuses-moved">
        <p className="admin-field-hint">{t('configStatusesMoved')}</p>
        <oas-button
          size="small"
          data-testid="admin-config-goto-settings"
          onClick={() => onNav?.('settings')}
        >
          {t('configGoSettings')}
        </oas-button>
      </div>
      <TrashPanel />
    </div>
  )
}

function LabelPanel() {
  const { settings } = useRepositories()
  const stored = useObservable(() => settings.live<string[]>('labels'), [settings])
  const labels = Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_LABELS
  const labelsRef = useRef(labels)
  labelsRef.current = labels
  const tagsRef = useRef<HTMLElement & { modelValue?: string[] }>(null)

  useEffect(() => {
    const el = tagsRef.current
    if (!el) return
    el.modelValue = labels
  }, [labels])

  useEffect(() => {
    const el = tagsRef.current
    if (!el) return
    const h = (e: Event) => {
      const v = (e as CustomEvent<{ value?: unknown }>).detail?.value
      if (!Array.isArray(v)) return
      const cleaned = v
        .filter((x): x is string => typeof x === 'string' && x.trim() !== '' && x !== '__none__')
        .map((x) => x.trim())
      if (cleaned.length === 0) {
        el.modelValue = labelsRef.current
        return
      }
      void settings.set('labels', cleaned)
    }
    el.addEventListener('oas-change', h)
    return () => el.removeEventListener('oas-change', h)
  }, [settings])

  return (
    <div className="admin-panel" data-testid="admin-config-labels">
      <p className="admin-panel-title">{t('adminCfgLabels')}</p>
      <oas-dynamic-tags
        ref={tagsRef}
        className="admin-labels-tags"
        data-testid="admin-labels-tags"
        placeholder={t('adminCfgLabelsPlaceholder')}
      />
      <p className="admin-hint">{t('adminCfgLabelsHint')}</p>
    </div>
  )
}

/** 工作流状态管理：列表（色点/名称/类别/排序）+ 新建/编辑/删除（含引用迁移与类别末位保护）。
 *  状态为工作区级一套（repo 语义），编辑即时落库，全站看板/筛选/抽屉实时跟随 */
function WorkflowPanel() {
  const { workflowStates, workflows, projects } = useRepositories()
  const wfList = useObservable(() => workflows.live(), [workflows])
  const projList = useObservable(() => projects.liveAll(), [projects])
  const [selectedWfId, setSelectedWfId] = useState<string | null>(null)
  const wf = (wfList ?? []).find((w) => w.id === (selectedWfId ?? 'wf-default')) ?? (wfList ?? [])[0]
  const states = useObservable(
    () => workflowStates.liveByWorkflow(wf?.id ?? 'wf-default'),
    [workflowStates, wf?.id],
  )
  const rows = useMemo(() => [...(states ?? [])].sort((a, b) => a.order - b.order), [states])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addingWf, setAddingWf] = useState(false)
  const projName = (pid: string | null) => projList?.find((p) => p.id === pid)?.name ?? ''
  // 选中工作流被删除后回落默认
  useEffect(() => {
    if (wfList && wfList.length > 0 && !wfList.some((w) => w.id === selectedWfId)) {
      setSelectedWfId('wf-default')
    }
  }, [wfList, selectedWfId])

  return (
    <div className="admin-panel" data-testid="admin-config-workflow">
      <p className="admin-panel-title">{t('adminCfgWorkflow')}</p>
      {/* 工作流选择条：默认 / 已绑定项目 / 闲置 */}
      <div className="wf-tabs" data-testid="admin-workflow-tabs">
        {(wfList ?? []).map((w) => (
          <button
            key={w.id}
            type="button"
            className={`wf-tab${wf?.id === w.id ? ' is-on' : ''}`}
            onClick={() => setSelectedWfId(w.id)}
          >
            <span>{w.name}</span>
            <span className="wf-tag">
              {w.projectId == null ? t('adminCfgWfDefault') : projName(w.projectId) || '…'}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="wf-tab wf-tab-add"
          onClick={() => setAddingWf(true)}
        >
          ＋ {t('adminCfgWfNew')}
        </button>
      </div>
      {addingWf && <WorkflowCreateForm projList={projList ?? []} onDone={() => setAddingWf(false)} />}
      {/* 选中工作流（非默认）操作：绑定信息 + 解绑 */}
      {wf && wf.projectId != null && (
        <div className="wf-ops-bar">
          <span className="wf-bind-info">
            {t('adminCfgWfBindProject')}：{projName(wf.projectId)}
          </span>
          <oas-button
            size="small"
            data-testid="admin-workflow-unbind"
            onClick={() => void workflows.update(wf.id, { projectId: null })}
          >
            {t('adminCfgWfUnbind')}
          </oas-button>
        </div>
      )}
      {wf && (
        <>
          <div className="wf-rows" data-testid="admin-workflow-rows">
            {rows.map((s) =>
              editingId === s.id ? (
                <WorkflowRowForm
                  key={s.id}
                  initial={s}
                  rows={rows}
                  workflowId={wf.id}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <WorkflowRow key={s.id} state={s} rows={rows} onEdit={() => setEditingId(s.id)} />
              ),
            )}
          </div>
          {adding ? (
            <WorkflowRowForm rows={rows} workflowId={wf.id} onDone={() => setAdding(false)} />
          ) : (
            <oas-button size="small" data-testid="admin-workflow-add" onClick={() => setAdding(true)}>
              {t('adminCfgWfAdd')}
            </oas-button>
          )}
        </>
      )}
      <p className="admin-hint">{t('adminCfgWfHint')}</p>
    </div>
  )
}

/** 新建工作流：名称 + 绑定项目（空 = 闲置/不被任何项目使用） */
function WorkflowCreateForm({
  projList,
  onDone,
}: {
  projList: Project[]
  onDone: () => void
}) {
  const { workflows } = useRepositories()
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const busyRef = useRef(false)
  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed || busyRef.current) return
    busyRef.current = true
    try {
      await workflows.create({ name: trimmed, projectId })
      onDone()
    } finally {
      busyRef.current = false
    }
  }
  return (
    <div className="wf-row-form" data-testid="admin-workflow-create">
      <oas-input
        value={name}
        placeholder={t('adminCfgWfNameWf')}
        aria-label={t('adminCfgWfNameWf')}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
      />
      <select
        className="wf-cat-select"
        aria-label={t('adminCfgWfBindProject')}
        value={projectId ?? ''}
        onChange={(e) => setProjectId(e.target.value || null)}
      >
        <option value="">{t('adminCfgWfNoProject')}</option>
        {projList.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <oas-button size="small" type="primary" data-testid="admin-workflow-create-save" onClick={() => void save()}>
        {t('save')}
      </oas-button>
      <oas-button size="small" onClick={onDone}>
        {t('cancel')}
      </oas-button>
    </div>
  )
}

/** 行内新建/编辑表单：名称 + 类别 + 颜色（预设色板点选） */
function WorkflowRowForm({
  initial,
  rows,
  workflowId,
  onDone,
}: {
  initial?: WorkflowState
  rows: WorkflowState[]
  workflowId?: string
  onDone: () => void
}) {
  const { workflowStates } = useRepositories()
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<WorkflowState['category']>(
    initial?.category ?? guessCategory(rows),
  )
  const [color, setColor] = useState(
    initial?.color ?? CATEGORY_COLOR[initial?.category ?? guessCategory(rows)],
  )
  const busyRef = useRef(false)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed || busyRef.current) return
    busyRef.current = true
    try {
      if (initial) {
        await workflowStates.update(initial.id, { name: trimmed, category, color })
      } else {
        const maxOrder = rows.reduce((m, s) => Math.max(m, s.order), 0)
        await workflowStates.create({
          projectId: 'workspace',
          name: trimmed,
          category,
          color,
          workflowId,
          order: maxOrder + 1,
        })
      }
      onDone()
    } finally {
      busyRef.current = false
    }
  }

  return (
    <div
      className="wf-row-form"
      data-testid={initial ? 'admin-workflow-edit' : 'admin-workflow-new'}
    >
      <oas-input
        value={name}
        placeholder={t('adminCfgWfName')}
        aria-label={t('adminCfgWfName')}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
      />
      <select
        className="wf-cat-select"
        aria-label={t('adminCfgWfCategory')}
        value={category}
        onChange={(e) => {
          const cat = e.target.value as WorkflowState['category']
          setCategory(cat)
          if (!initial) setColor(CATEGORY_COLOR[cat])
        }}
      >
        {CATEGORY_KEYS.map((k) => (
          <option key={k} value={k}>
            {CATEGORY_LABEL[k]}
          </option>
        ))}
      </select>
      {/* 色板：一排开关按钮（aria-pressed 标记选中）——不用 radiogroup/radio 角色，
          规避 biome useSemanticElements/noArrayIndexKey；a11y 由 aria-label + aria-pressed 承载 */}
      <div className="wf-color-row">
        {[...new Set([color, ...AVATAR_PALETTE])].map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === color}
            className={`wf-color${c === color ? ' is-on' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={`${t('adminCfgWfColor')}: ${c}`}
          />
        ))}
      </div>
      <oas-button
        size="small"
        type="primary"
        data-testid="admin-workflow-save"
        onClick={() => void save()}
      >
        {t('save')}
      </oas-button>
      <oas-button size="small" onClick={onDone}>
        {t('cancel')}
      </oas-button>
    </div>
  )
}

/** 新建时按现有构成猜缺省类别（每类已有一态时轮转 todo→started→done→cancelled） */
function guessCategory(rows: WorkflowState[]): WorkflowState['category'] {
  const next: WorkflowState['category'][] = ['todo', 'started', 'done', 'cancelled']
  for (const cat of next) {
    if (!rows.some((s) => s.category === cat)) return cat
  }
  return 'todo'
}

function WorkflowRow({
  state,
  rows,
  onEdit,
}: {
  state: WorkflowState
  rows: WorkflowState[]
  onEdit: () => void
}) {
  const { workflowStates } = useRepositories()
  const sameCat = rows.filter((s) => s.category === state.category)
  /** 类别末位保护：todo/started/done/cancelled 的语义判定依赖每类至少一态 */
  const lastOfCategory = sameCat.length <= 1
  const [migrateTo, setMigrateTo] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const idx = rows.findIndex((s) => s.id === state.id)

  const doRemove = async () => {
    const target = migrateTo ?? rows.filter((s) => s.id !== state.id)[0]?.id
    if (!target) return
    // 引用迁移先行（该状态下的 Issue 批量转到目标态），再删状态。
    // 属业务层数据一致性（跨 workflowStates/issues 两实体），非组件库职责——保留自实现
    await workflowStates.migrateStatus(state.id, target)
    await workflowStates.delete(state.id)
    setConfirming(false)
  }
  const move = async (dir: -1 | 1) => {
    const other = rows[idx + dir]
    if (!other) return
    const ids = rows.map((s) => s.id)
    ;[ids[idx], ids[idx + dir]] = [ids[idx + dir], ids[idx]]
    await workflowStates.reorder(ids)
    void other
  }

  return (
    <div className="wf-row" data-testid={`admin-workflow-row-${state.id}`}>
      <i
        className="dot"
        style={{ '--dot': workflowStateColorOf(state) } as CSSProperties}
        aria-hidden="true"
      />
      {confirming ? (
        <div className="wf-migrate" data-testid={`admin-workflow-migrate-${state.id}`}>
          <span>{t('adminCfgWfMigrate')}</span>
          <select
            aria-label={t('adminCfgWfMigrate')}
            value={migrateTo ?? ''}
            onChange={(e) => setMigrateTo(e.target.value || null)}
          >
            {rows
              .filter((s) => s.id !== state.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <oas-button
            size="small"
            type="primary"
            data-testid={`admin-workflow-del-go`}
            onClick={() => void doRemove()}
          >
            {t('confirm')}
          </oas-button>
          <oas-button size="small" onClick={() => setConfirming(false)}>
            {t('cancel')}
          </oas-button>
        </div>
      ) : (
        <>
          <span className="wf-name">{state.name}</span>
          <span className="wf-cat">{CATEGORY_LABEL[state.category]}</span>
          <span className="wf-ops">
            <oas-button
              size="small"
              onClick={() => void move(-1)}
              disabled={idx <= 0}
              aria-label={t('moveUp')}
            >
              <oas-icon name="chevron-up" size={13} />
            </oas-button>
            <oas-button
              size="small"
              onClick={() => void move(1)}
              disabled={idx >= rows.length - 1}
              aria-label={t('moveDown')}
            >
              <oas-icon name="chevron-down" size={13} />
            </oas-button>
            <oas-button
              size="small"
              data-testid={`admin-workflow-edit-${state.id}`}
              onClick={onEdit}
            >
              {t('edit')}
            </oas-button>
            {lastOfCategory ? (
              <oas-button
                size="small"
                disabled
                data-testid={`admin-workflow-del-${state.id}`}
                title={t('adminCfgWfLastOfCat')}
              >
                {t('delete')}
              </oas-button>
            ) : (
              <oas-button
                size="small"
                data-testid={`admin-workflow-del-${state.id}`}
                onClick={() => {
                  setMigrateTo(rows.filter((s) => s.id !== state.id)[0]?.id ?? null)
                  setConfirming(true)
                }}
              >
                {t('delete')}
              </oas-button>
            )}
          </span>
        </>
      )}
    </div>
  )
}

function workflowStateColorOf(s: WorkflowState): string {
  if (s.color) return s.color
  const tone: Record<WorkflowState['category'], string> = {
    todo: '#94a3b8',
    started: '#0b6cff',
    done: '#16a34a',
    cancelled: '#94a3b8',
  }
  return tone[s.category]
}

function ReadOnlyTags({
  testid,
  title,
  tags,
}: {
  testid: string
  title: string
  tags: Array<{ key: string; label: string; type?: string }>
}) {
  return (
    <div className="admin-panel" data-testid={testid}>
      <p className="admin-panel-title">
        {title}
        <span className="admin-ro-badge">{t('adminCfgReadOnly')}</span>
      </p>
      <div className="admin-tag-row">
        {tags.map((tag) => (
          <oas-tag key={tag.key} size="small" type={tag.type}>
            {tag.label}
          </oas-tag>
        ))}
      </div>
    </div>
  )
}

/** 回收站（工作项页签内的子视图）：列出软删除的工作项，行内恢复 / 永久删除。
 *  入口本身随管理台一起只对 admin 开放；API 模式下恢复与永久删除也会被服务端二次校验 */
function TrashPanel() {
  const { issues: issuesRepo, projects: projectsRepo } = useRepositories()
  const trash = useObservable(() => issuesRepo.liveTrash(), [issuesRepo])
  const projectList = useObservable(() => projectsRepo.liveAll(), [projectsRepo])
  const tableRef = useRef<TableHost>(null)
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<number | undefined>(undefined)

  const projectName = useMemo(() => {
    const map = new Map((projectList ?? []).map((p) => [p.id, p.name]))
    return (id: string) => map.get(id) ?? id
  }, [projectList])

  const flash = useCallback((msg: string) => {
    setNotice(msg)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 4000)
  }, [])
  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const trashRef = useRef(trash)
  trashRef.current = trash

  const restore = useCallback(
    async (id: string) => {
      const row = (trashRef.current ?? []).find((x) => x.id === id)
      await issuesRepo.restore(id)
      flash(t('adminTrashRestored').replace('{key}', row?.key ?? id))
    },
    [issuesRepo, flash],
  )
  const restoreRef = useRef(restore)
  restoreRef.current = restore

  const purge = useCallback(
    async (id: string) => {
      const row = (trashRef.current ?? []).find((x) => x.id === id)
      await issuesRepo.purge(id)
      flash(t('adminTrashPurged').replace('{key}', row?.key ?? id))
    },
    [issuesRepo, flash],
  )
  const purgeRef = useRef(purge)
  purgeRef.current = purge

  const rows = useMemo(
    () =>
      (trash ?? []).map((i) => ({
        id: i.id,
        key: i.key,
        title: i.title,
        project: projectName(i.projectId),
        deletedAt: i.deletedAt ? new Date(i.deletedAt).toLocaleString() : '—',
      })),
    [trash, projectName],
  )

  const columns = useMemo<Col[]>(
    () => [
      { key: 'key', title: t('key') },
      { key: 'title', title: t('title') },
      { key: 'project', title: t('project') },
      { key: 'deletedAt', title: t('adminColDeletedAt') },
      {
        key: 'actions',
        title: t('adminColActions'),
        render: (row) => {
          const id = String(row.id)
          const box = document.createElement('span')
          box.style.display = 'inline-flex'
          box.style.alignItems = 'center'
          box.style.gap = '6px'
          const back = document.createElement('oas-button')
          back.setAttribute('size', 'small')
          back.setAttribute('data-testid', `admin-trash-restore-${id}`)
          back.textContent = t('adminTrashRestore')
          back.addEventListener('click', () => void restoreRef.current(id))
          const pop = document.createElement('oas-popconfirm')
          pop.setAttribute('title', t('adminTrashPurgeConfirm'))
          const gone = document.createElement('oas-button')
          gone.setAttribute('type', 'danger')
          gone.setAttribute('size', 'small')
          gone.setAttribute('data-testid', `admin-trash-purge-${id}`)
          gone.textContent = t('adminTrashPurge')
          pop.appendChild(gone)
          pop.addEventListener('oas-open-change', (e: Event) => {
            const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
            if (reason === 'ok') void purgeRef.current(id)
          })
          box.append(back, pop)
          return box
        },
      },
    ],
    [],
  )

  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    el.columns = columns
    el.data = rows
  }, [columns, rows])

  return (
    <div className="admin-panel" data-testid="admin-config-trash">
      <p className="admin-panel-title">{t('adminTrashTitle')}</p>
      <p className="admin-hint">{t('adminTrashHint')}</p>
      {notice && (
        <oas-alert type="success" size="small" data-testid="admin-trash-notice">
          {notice}
        </oas-alert>
      )}
      {trash !== undefined && trash.length === 0 ? (
        <oas-empty
          size="small"
          hide-image
          description={t('adminTrashEmpty')}
          data-testid="admin-trash-empty"
        />
      ) : (
        <oas-table
          ref={tableRef}
          className="admin-crud-table"
          row-key="id"
          aria-label={t('adminTrashTitle')}
          data-testid="admin-table-trash"
        />
      )}
    </div>
  )
}
