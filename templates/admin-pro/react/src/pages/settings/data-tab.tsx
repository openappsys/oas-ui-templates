// src/pages/settings/data-tab.tsx —— 数据与列表 Tab：表单呈现方式/每页条数
import { useRef, useState } from 'react'
import { useOasEvent } from '../../hooks/use-oas-event'
import { useT } from '../../hooks/use-t'
import { appMessage } from '../../lib/app-message'
import {
  FORM_MODE_KEY,
  PAGE_SIZE_KEY,
  type FormMode,
  readFormMode,
  readPageSize,
} from '../../settings-init'

const FORM_MODE_OPTIONS: Array<{ value: FormMode; labelKey: string; descKey: string }> = [
  {
    value: 'dialog',
    labelKey: 'settings.formMode.dialog',
    descKey: 'settings.formMode.dialogDesc',
  },
  {
    value: 'drawer',
    labelKey: 'settings.formMode.drawer',
    descKey: 'settings.formMode.drawerDesc',
  },
  { value: 'page', labelKey: 'settings.formMode.page', descKey: 'settings.formMode.pageDesc' },
]

const PAGE_SIZES = [5, 10, 20, 50]

export function DataTab() {
  const { t } = useT()
  const [formMode, setFormMode] = useState(readFormMode)
  const [pageSize, setPageSize] = useState(readPageSize)
  const formModeGroupRef = useRef<HTMLDivElement | null>(null)
  const pageSizeRef = useRef<HTMLElement | null>(null)

  useOasEvent(formModeGroupRef, 'oas-change', (_detail: unknown, ev) => {
    const radio = ev.composedPath()[0] as HTMLElement
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value') as FormMode | null
    if (!v) return
    localStorage.setItem(FORM_MODE_KEY, v)
    setFormMode(v)
    appMessage.success(t('common.saved'))
  })

  useOasEvent<{ value: string }>(pageSizeRef, 'oas-change', (detail) => {
    if (!detail.value) return
    localStorage.setItem(PAGE_SIZE_KEY, detail.value)
    setPageSize(detail.value)
    appMessage.success(t('common.saved'))
  })

  return (
    <>
      <div className="setting-group">
        <div className="setting-group-title">{t('settings.general.formModeTitle')}</div>
        <div className="form-hint">{t('settings.general.formModeHint')}</div>
        <div
          className="radio-group"
          data-testid="form-mode-group"
          id="form-mode-group"
          ref={formModeGroupRef}
        >
          {FORM_MODE_OPTIONS.map((o) => (
            <oas-radio key={o.value} name="formMode" value={o.value} checked={formMode === o.value}>
              <span className="radio-item">
                <span className="radio-label">{t(o.labelKey)}</span>
                <span className="radio-desc">{t(o.descKey)}</span>
              </span>
            </oas-radio>
          ))}
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.general.pageSizeLabel')}</div>
            <div className="setting-hint">{t('settings.general.pageSizeHint')}</div>
          </div>
          <oas-select
            ref={pageSizeRef}
            data-testid="page-size"
            value={pageSize}
            options={JSON.stringify(
              PAGE_SIZES.map((n) => ({
                label: t('settings.pageSizeItem', { count: n }),
                value: String(n),
              })),
            )}
          />
        </div>
      </div>
    </>
  )
}
