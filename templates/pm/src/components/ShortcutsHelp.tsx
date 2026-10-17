import { useEffect, useRef } from 'react'
import { t } from '@/i18n'

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open) el.setAttribute('visible', '')
    else el.removeAttribute('visible')
  }, [open])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = (e: Event) => {
      if (e.defaultPrevented) return
      onClose()
    }
    el.addEventListener('oas-before-close', h)
    el.addEventListener('oas-close', h)
    return () => {
      el.removeEventListener('oas-before-close', h)
      el.removeEventListener('oas-close', h)
    }
  }, [onClose])
  const rows: Array<{ keys: string[]; label: string }> = [
    { keys: ['ctrl', 'k'], label: t('shortcutPalette') },
    { keys: ['C'], label: t('shortcutNew') },
    { keys: ['/'], label: t('shortcutSearch') },
    { keys: ['j', 'k'], label: t('shortcutCursor') },
    { keys: ['x'], label: t('shortcutBulk') },
    { keys: ['enter'], label: t('shortcutOpen') },
    { keys: ['?'], label: t('shortcutHelp') },
    { keys: ['esc'], label: t('shortcutClose') },
  ]
  return (
    <oas-modal ref={ref} no-footer data-testid="shortcuts-help" title={t('shortcutsTitle')}>
      <div className="shortcuts-body">
        {rows.map((r) => (
          <div className="shortcut-row" key={r.label}>
            <span className="shortcut-keys">
              {r.keys.map((k) => (
                <oas-kbd key={k} keys={k} />
              ))}
            </span>
            <span className="shortcut-label">{r.label}</span>
          </div>
        ))}
      </div>
    </oas-modal>
  )
}
