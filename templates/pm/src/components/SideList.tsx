import { useEffect, useRef } from 'react'
import { registerIcon } from '@oas-ui/icons/runtime'
import { t } from '@/i18n'

export interface SideRow {
  group: string
  value: string
  kind: 'project' | 'view' | 'status' | 'savedview' | 'member'
  id?: string
  label: string
  count?: string
  statusColor?: string
  deletable?: boolean
  savedFilters?: string
  avatarColor?: string
  avatarText?: string
}

interface SidebarItemLike {
  label: string
  value: string
  group?: string
  icon?: string
  iconColor?: string
  badge?: string | number
  avatarText?: string
  avatarColor?: string
  actions?: { icon?: string; value: string; label: string }[]
}

registerIcon(
  'pm-status-dot',
  '<circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="4.6"/>',
)

export function SideList({
  rows,
  activeByGroup,
  onRowClick,
  onDeleteSavedView,
}: {
  rows: SideRow[]
  activeByGroup: Record<string, string | string[]>
  onRowClick: (row: SideRow) => void
  onDeleteSavedView: (id: string) => void
}) {
  const barRef = useRef<HTMLElement & { items?: unknown }>(null)
  const handlersRef = useRef({ onRowClick, onDeleteSavedView })
  handlersRef.current = { onRowClick, onDeleteSavedView }
  const rowMapRef = useRef(new Map<string, SideRow>())

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const onSelect = (e: Event) => {
      const value = (e as CustomEvent<{ value?: string }>).detail?.value ?? ''
      const row = rowMapRef.current.get(value)
      if (row) handlersRef.current.onRowClick(row)
    }
    const onAction = (e: Event) => {
      const d = (e as CustomEvent<{ value?: string; action?: string }>).detail
      if (d?.action !== 'del') return
      const id = rowMapRef.current.get(d.value ?? '')?.id
      if (id) handlersRef.current.onDeleteSavedView(id)
    }
    el.addEventListener('oas-select', onSelect)
    el.addEventListener('oas-action', onAction)
    return () => {
      el.removeEventListener('oas-select', onSelect)
      el.removeEventListener('oas-action', onAction)
    }
  }, [])

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const map = new Map<string, SideRow>()
    const items: SidebarItemLike[] = rows.map((row) => {
      map.set(row.value, row)
      const item: SidebarItemLike = { label: row.label, value: row.value, group: row.group }
      if (row.count != null) item.badge = row.count
      if (row.statusColor) {
        item.icon = 'pm-status-dot'
        item.iconColor = row.statusColor
      }
      if (row.avatarColor) {
        item.avatarText = row.avatarText ?? ''
        item.avatarColor = row.avatarColor
      }
      if (row.deletable && row.id) {
        item.actions = [
          { icon: 'close', value: 'del', label: t('deleteView').replace('{name}', row.label) },
        ]
      }
      return item
    })
    rowMapRef.current = map
    const root = el.shadowRoot
    const focusedRow =
      root?.activeElement instanceof HTMLElement
        ? root.activeElement.closest<HTMLElement>('[part="item"]')
        : null
    const focusValue = focusedRow?.dataset.value ?? null
    el.items = items
    el.setAttribute('active-by-group', JSON.stringify(activeByGroup))
    if (focusValue) {
      root
        ?.querySelector<HTMLElement>(`[part="item"][data-value="${CSS.escape(focusValue)}"]`)
        ?.focus({ preventScroll: true })
    }
  }, [rows, activeByGroup])

  return <oas-sidebar ref={barRef} data-testid="side-list" hide-toggle="" />
}
