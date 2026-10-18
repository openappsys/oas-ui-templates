import { useEffect, useRef } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { t } from '@/i18n'
import { ISSUE_PRIORITIES, ISSUE_STATUSES, PRIORITY_LABEL, STATUS_LABEL } from '@/types'
import { DEFAULT_LABELS } from '@/lib/labels'

const PRIORITY_TAG_TYPE: Record<string, string> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
}

export function ConfigTab() {
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
    <div className="admin-crud-page" data-testid="admin-tab-config">
      <h1 className="page-h1">{t('adminConfigTitle')}</h1>
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
      <div className="admin-panel" data-testid="admin-config-priorities">
        <p className="admin-panel-title">
          {t('priority')}
          <span className="admin-ro-badge">{t('adminCfgReadOnly')}</span>
        </p>
        <div className="admin-tag-row">
          {ISSUE_PRIORITIES.map((p) => (
            <oas-tag key={p} size="small" type={PRIORITY_TAG_TYPE[p]}>
              {PRIORITY_LABEL[p]}
            </oas-tag>
          ))}
        </div>
      </div>
      <div className="admin-panel" data-testid="admin-config-statuses">
        <p className="admin-panel-title">
          {t('status')}
          <span className="admin-ro-badge">{t('adminCfgReadOnly')}</span>
        </p>
        <div className="admin-tag-row">
          {ISSUE_STATUSES.map((s) => (
            <oas-tag key={s} size="small">
              {STATUS_LABEL[s]}
            </oas-tag>
          ))}
        </div>
      </div>
    </div>
  )
}
