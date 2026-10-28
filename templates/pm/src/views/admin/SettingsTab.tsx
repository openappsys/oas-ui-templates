import { useCallback, useEffect, useRef, useState } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { activeDataSource } from '@/data/source'
import { ALL_PROJECTS } from '@/lib/filters'
import { t, type Lang } from '@/i18n'
import { DEFAULT_SEED_SIZE } from '@/lib/seed-size'
import { useWorkflowStates, workflowStateColor, workflowStateLabel } from '@/lib/statuses'
import { OSelect } from '@/components/oas-wrappers'
import type { CommentMode, ThemePreference } from '@/lib/preferences'
import type { WorkflowState } from '@/types'

export function SettingsTab({
  currentUser,
  themePref,
  onSetTheme,
  lang,
  onSetLang,
  commentModeDefault,
  onSetCommentModeDefault,
}: {
  currentUser: string
  themePref: ThemePreference
  onSetTheme: (pref: ThemePreference) => void
  lang: Lang
  onSetLang: (lang: Lang) => void
  commentModeDefault: CommentMode
  onSetCommentModeDefault: (m: CommentMode) => void
}) {
  const { admin } = useRepositories()
  // 启动时决断、不热切换：这里只取展示文案，不构成实现分支
  const dataSource = activeDataSource()
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const errorTimer = useRef<number | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const resetPopRef = useRef<HTMLElement>(null)
  const wipePopRef = useRef<HTMLElement>(null)
  const [seedSize, setSeedSize] = useState<string>(
    () => localStorage.getItem('oas-pm-seed-size') ?? String(DEFAULT_SEED_SIZE),
  )

  const showError = useCallback((msg: string) => {
    setError(msg)
    window.clearTimeout(errorTimer.current)
    errorTimer.current = window.setTimeout(() => setError(''), 6000)
  }, [])
  useEffect(() => () => window.clearTimeout(errorTimer.current), [])

  const beginAction = useCallback(() => {
    setOk('')
    busyRef.current = true
    setBusy(true)
  }, [])
  const endAction = useCallback(() => {
    busyRef.current = false
    setBusy(false)
  }, [])

  const exportJson = useCallback(async () => {
    if (busyRef.current) return
    beginAction()
    try {
      const json = await admin.exportAll()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `oas-pm-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setOk(t('adminExportDone'))
    } catch (e) {
      showError(`${t('adminDataFailed')}${e instanceof Error ? e.message : String(e)}`)
    } finally {
      endAction()
    }
  }, [admin, showError, beginAction, endAction])

  const importJson = useCallback(async () => {
    if (busyRef.current) return
    const file = fileRef.current?.files?.[0]
    if (!file) {
      showError(t('adminImportNoFile'))
      return
    }
    beginAction()
    try {
      const text = await file.text()
      await admin.importAll(text)
      if (fileRef.current) fileRef.current.value = ''
      setOk(t('adminImportDone'))
    } catch (e) {
      showError(`${t('adminDataFailed')}${e instanceof Error ? e.message : String(e)}`)
    } finally {
      endAction()
    }
  }, [admin, showError, beginAction, endAction])

  const resetDemo = useCallback(async () => {
    if (busyRef.current) return
    beginAction()
    try {
      await admin.resetDemo()
      location.reload()
    } catch (e) {
      showError(`${t('adminDataFailed')}${e instanceof Error ? e.message : String(e)}`)
      endAction()
    }
  }, [admin, showError, beginAction, endAction])

  const wipeAll = useCallback(async () => {
    if (busyRef.current) return
    beginAction()
    try {
      await admin.wipeAll(currentUser)
      setOk(t('adminWipeDone'))
    } catch (e) {
      showError(`${t('adminDataFailed')}${e instanceof Error ? e.message : String(e)}`)
    } finally {
      endAction()
    }
  }, [admin, currentUser, showError, beginAction, endAction])

  useEffect(() => {
    const el = resetPopRef.current
    if (!el) return
    const h = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
      if (reason === 'ok') void resetDemo()
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
  }, [resetDemo])
  useEffect(() => {
    const el = wipePopRef.current
    if (!el) return
    const h = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
      if (reason === 'ok') void wipeAll()
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
  }, [wipeAll])

  return (
    <div className="admin-crud-page admin-settings" data-testid="admin-tab-settings">
      <h1 className="page-h1">{t('adminSettingsTitle')}</h1>
      {error && (
        <oas-alert type="error" className="admin-crud-error" data-testid="admin-data-error">
          {error}
        </oas-alert>
      )}
      {ok && (
        <oas-alert type="success" className="admin-crud-error" data-testid="admin-data-ok">
          {ok}
        </oas-alert>
      )}
      <div className="admin-panel">
        <p className="admin-panel-title">{t('adminAppearanceLang')}</p>
        <div className="admin-field-row">
          <div className="admin-field-label">
            <span>{t('adminTheme')}</span>
          </div>
          <OSelect
            testid="admin-settings-theme"
            value={themePref}
            options={[
              { label: t('themeLight'), value: 'light' },
              { label: t('themeDark'), value: 'dark' },
              { label: t('themeSystem'), value: 'system' },
            ]}
            onChange={(v) => onSetTheme(v as ThemePreference)}
          />
        </div>
        <div className="admin-field-row">
          <div className="admin-field-label">
            <span>{t('adminLanguage')}</span>
          </div>
          <OSelect
            testid="admin-settings-lang"
            value={lang}
            options={[
              { label: t('langZh'), value: 'zh' },
              { label: t('langEn'), value: 'en' },
            ]}
            onChange={(v) => onSetLang(v as Lang)}
          />
        </div>
      </div>
      <div className="admin-panel">
        <p className="admin-panel-title">{t('adminComments')}</p>
        <div className="admin-field-row">
          <div className="admin-field-label">
            <span>{t('adminCommentModeLabel')}</span>
            <span className="admin-field-hint">{t('adminCommentModeHint')}</span>
          </div>
          <OSelect
            testid="admin-settings-comment-mode"
            value={commentModeDefault}
            options={[
              { label: t('modeFlat'), value: 'flat' },
              { label: t('modeThread'), value: 'thread' },
              { label: t('modeNested'), value: 'nested' },
            ]}
            onChange={(v) => onSetCommentModeDefault(v as CommentMode)}
          />
        </div>
      </div>
      <WorkflowStatesPanel />
      <div className="admin-panel" data-testid="admin-data-actions">
        <p className="admin-panel-title">{t('adminData')}</p>
        <div className="admin-field-row admin-source-row">
          <div className="admin-field-label">
            <span>{t('adminDataSource')}</span>
          </div>
          <strong className="admin-source-value" data-testid="admin-data-source">
            {t(dataSource === 'api' ? 'adminDataSourceApi' : 'adminDataSourceLocal')}
          </strong>
        </div>
        <div className="admin-data-row">
          <oas-button
            data-testid="admin-export-json"
            disabled={busy}
            onClick={() => void exportJson()}
          >
            {t('adminExportJson')}
          </oas-button>
          <input
            ref={fileRef}
            className="admin-import-file"
            type="file"
            accept=".json,application/json"
            data-testid="admin-import-json"
            aria-label={t('adminImportJson')}
          />
          <oas-button
            type="primary"
            data-testid="admin-import-btn"
            disabled={busy}
            onClick={() => void importJson()}
          >
            {t('adminImportBtn')}
          </oas-button>
          <oas-popconfirm
            ref={resetPopRef}
            title={t('adminResetDemoConfirm')}
            data-testid="admin-reset-demo-pop"
          >
            <oas-button data-testid="admin-reset-demo" disabled={busy}>
              {t('adminResetDemo')}
            </oas-button>
          </oas-popconfirm>
          <oas-popconfirm
            ref={wipePopRef}
            title={t('adminWipeAllConfirm')}
            data-testid="admin-wipe-all-pop"
          >
            <oas-button type="danger" data-testid="admin-wipe-all" disabled={busy}>
              {t('adminWipeAll')}
            </oas-button>
          </oas-popconfirm>
        </div>
        <div className="admin-field-row admin-seed-row">
          <div className="admin-field-label">
            <span>{t('adminSeedSize')}</span>
            <span className="admin-field-hint">{t('adminSeedSizeHint')}</span>
          </div>
          <OSelect
            testid="admin-seed-size"
            ariaLabel={t('adminSeedSize')}
            value={seedSize}
            options={[
              { label: '20,000', value: '20000' },
              { label: '50,000', value: '50000' },
              { label: '100,000', value: '100000' },
            ]}
            onChange={(v) => {
              setSeedSize(v)
              localStorage.setItem('oas-pm-seed-size', v)
            }}
          />
        </div>
      </div>
    </div>
  )
}

/* ── 工作流状态管理（M27）：改名/配色/类别/排序/增删，看板列与全部选择器实时跟随。
 *    状态是工作区级一套（与 labels 设置同层级），全项目共用 ── */
function WorkflowStatesPanel() {
  const { workflowStates: statesRepo, issues: issuesRepo } = useRepositories()
  const states = useWorkflowStates('workspace')
  // 计数口径 = 全部项目（状态本身跨项目）
  const counts = useObservable(() => issuesRepo.liveCounts(ALL_PROJECTS), [issuesRepo])
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState<WorkflowState['category']>('todo')
  const [error, setError] = useState('')
  const sorted = [...states].sort((a, b) => a.order - b.order)

  const swap = (idx: number, dir: -1 | 1) => {
    const next = [...sorted]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    void statesRepo.reorder(next.map((s) => s.id))
  }

  return (
    <div className="admin-panel" data-testid="admin-workflow-states">
      <p className="admin-panel-title">{t('workflowStates')}</p>
      <p className="admin-field-hint">{t('workflowStatesDesc')}</p>
      {error && (
        <p className="admin-cycle-warn" data-testid="admin-states-error">
          {error}
        </p>
      )}
      <div className="states-table" data-testid="admin-states-table">
        {sorted.map((s, i) => {
          const inUse = counts?.byStatus[s.id] ?? 0
          return (
            <div className="states-row" key={s.id} data-testid={`admin-state-row-${s.id}`}>
              <span
                className="states-dot"
                style={{ background: workflowStateColor(s) }}
                aria-hidden
              />
              <input
                className="comment-input states-name"
                data-testid={`admin-state-name-${s.id}`}
                key={`${s.id}:${s.name}`}
                defaultValue={s.name}
                onBlur={(e) => {
                  const name = e.target.value.trim()
                  if (name && name !== s.name) void statesRepo.update(s.id, { name })
                  else e.target.value = s.name
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
              <OSelect
                testid={`admin-state-cat-${s.id}`}
                value={s.category}
                options={[
                  { label: t('catTodo'), value: 'todo' },
                  { label: t('catStarted'), value: 'started' },
                  { label: t('catDone'), value: 'done' },
                  { label: t('catCancelled'), value: 'cancelled' },
                ]}
                onChange={(v) =>
                  void statesRepo.update(s.id, { category: v as WorkflowState['category'] })
                }
              />
              <input
                type="color"
                className="states-color"
                data-testid={`admin-state-color-${s.id}`}
                value={s.color ?? '#64748b'}
                onChange={(e) => void statesRepo.update(s.id, { color: e.target.value })}
              />
              <span className="states-count">{(counts?.byStatus[s.id] ?? 0).toLocaleString()}</span>
              <button
                type="button"
                className="states-move"
                data-testid={`admin-state-up-${s.id}`}
                disabled={i === 0}
                onClick={() => swap(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="states-move"
                data-testid={`admin-state-down-${s.id}`}
                disabled={i === sorted.length - 1}
                onClick={() => swap(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="states-del"
                data-testid={`admin-state-del-${s.id}`}
                title={t('stateDelete')}
                onClick={() => {
                  if (inUse > 0) {
                    setError(t('stateInUse').replace('{n}', String(inUse)))
                    return
                  }
                  setError('')
                  void statesRepo.delete(s.id)
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <div className="states-add-row">
        <input
          className="comment-input states-name"
          data-testid="admin-state-new-name"
          placeholder={t('stateName')}
          value={newName}
          onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
        />
        <OSelect
          testid="admin-state-new-cat"
          value={newCat}
          options={[
            { label: t('catTodo'), value: 'todo' },
            { label: t('catStarted'), value: 'started' },
            { label: t('catDone'), value: 'done' },
            { label: t('catCancelled'), value: 'cancelled' },
          ]}
          onChange={(v) => setNewCat(v as WorkflowState['category'])}
        />
        <oas-button
          size="small"
          type="primary"
          data-testid="admin-state-add"
          disabled={!newName.trim()}
          onClick={() => {
            const name = newName.trim()
            if (!name) return
            void statesRepo
              .create({ projectId: 'workspace', name, category: newCat, order: Date.now() })
              .then(() => setNewName(''))
          }}
        >
          {t('stateAdd')}
        </oas-button>
      </div>
      <p className="admin-field-hint">
        {sorted.map((s) => `${workflowStateLabel(s)}=${counts?.byStatus[s.id] ?? 0}`).join(' · ')}
      </p>
    </div>
  )
}
