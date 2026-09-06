// src/pages/settings/notification-tab.tsx —— 通知 Tab：3 类通知 × 2 渠道开关矩阵
// 本模版用受控 checks state 防止 locale 切换等无关重渲染把开关打回挂载初值。
import { useRef, useState } from 'react'
import { useOasEvent } from '../../hooks/use-oas-event'
import { useT } from '../../hooks/use-t'
import { NOTIF_PREFIX, readBool } from '../../settings-init'

const NOTIF_ROWS: Array<{ key: string; labelKey: string }> = [
  { key: 'orders', labelKey: 'settings.notif.orders' },
  { key: 'inventory', labelKey: 'settings.notif.inventory' },
  { key: 'system', labelKey: 'settings.notif.system' },
]
const NOTIF_CHANNELS: Array<{ key: string; labelKey: string }> = [
  { key: 'inapp', labelKey: 'settings.notif.inapp' },
  { key: 'email', labelKey: 'settings.notif.email' },
]

function readChecks(): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const row of NOTIF_ROWS) {
    for (const c of NOTIF_CHANNELS) {
      map[`${row.key}.${c.key}`] = readBool(`${NOTIF_PREFIX}${row.key}.${c.key}`, true)
    }
  }
  return map
}

export function NotificationTab() {
  const { t } = useT()
  const [checks, setChecks] = useState<Record<string, boolean>>(readChecks)
  const matrixRef = useRef<HTMLDivElement | null>(null)

  // 矩阵内 oas-switch 的 oas-change 在矩阵容器上委托：data-key 定位持久化键（vanilla 同款）
  useOasEvent<{ checked: boolean }>(matrixRef, 'oas-change', (detail, ev) => {
    const sw = ev.composedPath()[0] as HTMLElement
    const key = sw.getAttribute('data-key')
    if (!key) return
    localStorage.setItem(NOTIF_PREFIX + key, String(detail.checked))
    setChecks((prev) => ({ ...prev, [key]: detail.checked }))
  })

  return (
    <div className="setting-group">
      <div className="setting-group-title">{t('settings.notif.title')}</div>
      <div className="notif-matrix" data-testid="notif-matrix" id="notif-matrix" ref={matrixRef}>
        <div className="notif-row notif-head">
          <span>{t('settings.notif.type')}</span>
          {NOTIF_CHANNELS.map((c) => (
            <span key={c.key} className="notif-col">
              {t(c.labelKey)}
            </span>
          ))}
        </div>
        {NOTIF_ROWS.map((row) => (
          <div key={row.key} className="notif-row">
            <span className="notif-channel">{t(row.labelKey)}</span>
            {NOTIF_CHANNELS.map((c) => (
              <span key={c.key} className="notif-col">
                <oas-switch
                  data-testid={`notif-${row.key}-${c.key}`}
                  data-key={`${row.key}.${c.key}`}
                  checked={checks[`${row.key}.${c.key}`]}
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
