import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { t, priorityLabel, statusLabel } from '@/i18n'
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from '@/types'
import { DEFAULT_LABELS } from '@/lib/labels'

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

export function ConfigTab() {
  return (
    <div className="admin-crud-page" data-testid="admin-tab-config">
      <h1 className="page-h1">{t('adminConfigTitle')}</h1>
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
      <ReadOnlyTags
        testid="admin-config-statuses"
        title={t('status')}
        tags={ISSUE_STATUSES.map((s) => ({ key: s, label: statusLabel(s) }))}
      />
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
          pop.setAttribute('ok-text', t('confirm'))
          pop.setAttribute('cancel-text', t('cancel'))
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
          data-testid="admin-table-trash"
        />
      )}
    </div>
  )
}
