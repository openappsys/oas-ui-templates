import { useEffect, useRef } from 'react'

export interface SideRow {
  group: string
  value: string
  kind: 'project' | 'view' | 'status' | 'savedview' | 'member'
  id?: string
  testid: string
  label: string
  count?: string
  active?: boolean
  statusColor?: string
  deletable?: boolean
  savedFilters?: string
  avatarColor?: string
  avatarText?: string
}

const SIDE_STYLES = `
  .list[data-split='true'] .data-items oas-list-item {
    border-bottom: none;
  }
  .data-items .group-header {
    border-bottom: none;
    background: none;
    padding: 8px 10px 2px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .data-items oas-list-item.side-item {
    border-radius: 8px;
  }
  .data-items oas-list-item.side-item.is-active {
    color: var(--oas-color-primary, #0b6cff);
    background: color-mix(in srgb, var(--oas-color-primary, #0b6cff) 12%, transparent);
  }
  .side-item .side-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .side-item .side-count {
    margin-left: 8px;
    font-size: 11px;
    color: var(--oas-color-text-disabled, #94a3b8);
  }
  .side-item .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .side-item .saved-view-del {
    appearance: none;
    border: none;
    background: none;
    padding: 0 2px;
    margin-left: 4px;
    font-size: 12px;
    color: var(--oas-color-text-disabled, #94a3b8);
    cursor: pointer;
  }
  .side-item .saved-view-del:hover {
    color: var(--oas-color-danger-text, #dc2626);
  }
  .side-item .saved-view-del:focus-visible {
    outline: 2px solid var(--oas-color-primary);
    outline-offset: -2px;
  }
  @media (max-width: 900px) {
    .data-items .group-header,
    .side-item .side-label,
    .side-item .side-count,
    .side-item .saved-view-del {
      display: none;
    }
  }
`

function ensureSideStyles(root: ShadowRoot | null): void {
  if (!root || root.querySelector('style[data-side-list]')) return
  const st = document.createElement('style')
  st.setAttribute('data-side-list', '')
  st.textContent = SIDE_STYLES
  root.appendChild(st)
}

function renderSideRow(element: HTMLElement, row: SideRow, onDelete: (id: string) => void): void {
  element.textContent = ''
  element.className = `side-item${row.active ? ' is-active' : ''}${
    row.kind === 'savedview' ? ' saved-view-item' : ''
  }`
  element.setAttribute('data-testid', row.testid)
  element.setAttribute('clickable', '')
  if (row.statusColor) {
    const dot = document.createElement('span')
    dot.className = 'status-dot'
    dot.setAttribute('slot', 'icon')
    dot.style.background = row.statusColor
    element.appendChild(dot)
  }
  if (row.avatarColor) {
    const av = document.createElement('oas-avatar')
    av.setAttribute('slot', 'avatar')
    av.setAttribute('size', '16')
    av.setAttribute('color', row.avatarColor)
    av.title = row.label
    av.textContent = row.avatarText ?? ''
    element.appendChild(av)
  }
  const label = document.createElement('span')
  label.className = 'side-label'
  label.setAttribute('slot', 'title')
  label.textContent = row.label
  element.appendChild(label)
  if (row.count != null) {
    const count = document.createElement('span')
    count.className = 'side-count'
    count.setAttribute('slot', 'extra')
    count.textContent = row.count
    element.appendChild(count)
  }
  if (row.deletable && row.id) {
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'saved-view-del'
    del.setAttribute('slot', 'extra')
    del.setAttribute('aria-label', `删除视图 ${row.label}`)
    del.setAttribute('data-testid', `saved-view-del-${row.id}`)
    del.textContent = '×'
    del.addEventListener('click', (e) => {
      e.stopPropagation()
      onDelete(row.id as string)
    })
    element.appendChild(del)
  }
}

export function SideList({
  rows,
  onRowClick,
  onDeleteSavedView,
}: {
  rows: SideRow[]
  onRowClick: (row: SideRow) => void
  onDeleteSavedView: (id: string) => void
}) {
  const listRef = useRef<HTMLElement & { data?: unknown[] }>(null)
  const handlersRef = useRef({ onRowClick, onDeleteSavedView })
  handlersRef.current = { onRowClick, onDeleteSavedView }

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const onRender = (e: Event) => {
      const d = (e as CustomEvent<{ index: number; item: SideRow; element: HTMLElement }>).detail
      if (!d?.element || !d.item) return
      ensureSideStyles(el.shadowRoot)
      renderSideRow(d.element, d.item, (id) => handlersRef.current.onDeleteSavedView(id))
    }
    const onClick = (e: Event) => {
      const row = (e as CustomEvent<{ index: number; item: SideRow }>).detail?.item
      if (row) handlersRef.current.onRowClick(row)
    }
    el.addEventListener('oas-item-render', onRender)
    el.addEventListener('oas-click', onClick)
    return () => {
      el.removeEventListener('oas-item-render', onRender)
      el.removeEventListener('oas-click', onClick)
    }
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const root = el.shadowRoot
    const focused = root?.activeElement
    const focusTid = focused instanceof HTMLElement ? focused.getAttribute('data-testid') : null
    el.data = rows
    if (focusTid) {
      const next = root?.querySelector(`[data-testid="${CSS.escape(focusTid)}"]`)
      if (next instanceof HTMLElement) next.focus({ preventScroll: true })
    }
  }, [rows])

  return <oas-list ref={listRef} className="side-list" size="sm" />
}
