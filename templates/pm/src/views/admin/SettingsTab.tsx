import { useCallback, useEffect, useRef, useState } from 'react'
import { useRepositories } from '@/data/context'
import { activeDataSource } from '@/data/source'
import { t, type Lang } from '@/i18n'
import { DEFAULT_SEED_SIZE } from '@/lib/seed-size'
import { OSelect } from '@/components/oas-wrappers'
import type { ThemePreference } from '@/lib/preferences'

export function SettingsTab({
  currentUser,
  themePref,
  onSetTheme,
  lang,
  onSetLang,
}: {
  currentUser: string
  themePref: ThemePreference
  onSetTheme: (pref: ThemePreference) => void
  lang: Lang
  onSetLang: (lang: Lang) => void
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
    <div className="admin-crud-page" data-testid="admin-tab-settings">
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
        <p className="admin-panel-title">{t('adminAppearance')}</p>
        <div className="admin-field-row">
          <span>{t('adminTheme')}</span>
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
          <span>{t('adminLanguage')}</span>
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
      <div className="admin-panel" data-testid="admin-data-actions">
        <p className="admin-panel-title">{t('adminData')}</p>
        <div className="admin-field-row admin-source-row">
          <span>{t('adminDataSource')}</span>
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
        <div className="admin-seed-row">
          <span className="admin-field-label">{t('adminSeedSize')}</span>
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
          <span className="admin-hint">{t('adminSeedSizeHint')}</span>
        </div>
      </div>
    </div>
  )
}
