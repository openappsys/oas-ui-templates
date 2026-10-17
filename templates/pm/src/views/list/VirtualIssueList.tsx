import { useEffect, useRef } from 'react'
import type { Issue, Member } from '@/types'
import { STATUS_LABEL } from '@/types'
import { PRIORITY_TEXT, STATUS_TEXT } from '@/lib/colors'

/** 行样式注入所在 shadow root（每次渲染幂等）：light CSS 不穿透，inline grid 在该容器不稳 */
function ensureRowStyles(root: ShadowRoot | null): void {
  if (!root || root.querySelector('style[data-issue-row]')) return
  const st = document.createElement('style')
  st.setAttribute('data-issue-row', '')
  st.textContent = `
    .issue-row {
      display: grid;
      grid-template-columns: 22px 96px minmax(0, 1fr) 22px 64px 84px;
      align-items: center;
      gap: 10px;
      height: 44px;
      padding: 0 16px;
      border-bottom: 1px solid var(--oas-color-border, #eef2f7);
      cursor: pointer;
      font-size: 12px;
      width: 100%;
      box-sizing: border-box;
    }
    .issue-row:hover {
      background: var(--oas-color-bg-hover, #f8fafc);
    }
    .issue-row.is-cursor {
      background: var(--oas-color-bg-hover, #f8fafc);
      box-shadow: inset 2px 0 0 var(--oas-color-primary, #0b6cff);
    }
    .issue-row .issue-key {
      color: var(--oas-color-primary, #0b6cff);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .issue-row .issue-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .issue-row .row-check {
      width: 14px;
      height: 14px;
      cursor: pointer;
    }
    .issue-row .row-check::part(box) {
      margin-block-start: 0;
    }
    .issue-row.no-check {
      grid-template-columns: 96px minmax(0, 1fr) 22px 64px 84px;
    }
    .issue-row .issue-priority,
    .issue-row .issue-status {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `
  root.appendChild(st)
}

function renderIssueRow(
  element: HTMLElement,
  issue: Issue,
  memberMap: Map<string, Member>,
  onSelect: (id: string) => void,
  selectedIds: Set<string>,
  toggleSelect: (id: string) => void,
  showCheckbox: boolean,
  isCursor: boolean,
) {
  element.textContent = ''
  element.style.display = 'block'
  element.style.width = '100%'
  ensureRowStyles(element.getRootNode() as ShadowRoot)
  const row = document.createElement('div')
  row.className = isCursor ? 'issue-row is-cursor' : 'issue-row'
  if (!showCheckbox) row.classList.add('no-check')
  row.setAttribute('role', 'button')
  row.setAttribute('tabindex', '0')
  const add = (
    cls: string,
    text: string,
    opts: { color?: string; weight?: string; mono?: boolean } = {},
  ) => {
    const s = document.createElement('span')
    s.className = cls
    s.textContent = text
    if (opts.color) s.style.color = opts.color
    if (opts.mono) s.style.fontFamily = 'ui-monospace, SFMono-Regular, Consolas, monospace'
    row.appendChild(s)
    return s
  }
  add('issue-key', issue.key)
  add('issue-title', issue.title)
  const m = memberMap.get(issue.assigneeId ?? '')
  const av = document.createElement('oas-avatar')
  av.setAttribute('size', '20')
  if (m) {
    av.setAttribute('color', m.avatarColor)
    av.title = m.name
    av.textContent = m.name[0]
  } else {
    av.setAttribute('color', 'var(--oas-color-border-strong)')
    av.title = '未分配'
  }
  row.appendChild(av)
  add(`issue-priority pri-${issue.priority}`, issue.priority, {
    color: PRIORITY_TEXT[issue.priority],
  })
  add(`issue-status st-${issue.status}`, STATUS_LABEL[issue.status], {
    color: STATUS_TEXT[issue.status],
  })
  row.addEventListener('click', () => onSelect(issue.id))
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') onSelect(issue.id)
  })
  if (showCheckbox) {
    // 行首多选框：点击不触发行打开
    const check = document.createElement('oas-checkbox')
    check.className = 'row-check'
    check.setAttribute('data-testid', 'row-check')
    check.setAttribute('size', 'small')
    check.toggleAttribute('checked', selectedIds.has(issue.id))
    check.addEventListener('click', (e) => {
      e.stopPropagation()
    })
    check.addEventListener('oas-change', () => {
      toggleSelect(issue.id)
    })
    row.insertBefore(check, row.firstChild)
  }
  element.appendChild(row)
}

export function VirtualIssueList({
  issues,
  onSelect,
  memberMap,
  selectedIds,
  toggleSelect,
  showCheckbox,
  cursorIndex,
}: {
  issues: Issue[]
  onSelect: (id: string) => void
  memberMap: Map<string, Member>
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  showCheckbox: boolean
  cursorIndex: number
}) {
  const listRef = useRef<HTMLElement>(null)
  const lastTopRef = useRef(0)
  // 稳定的渲染回调：避免 items 变化以外的原因重挂监听
  const renderRef = useRef({
    onSelect,
    memberMap,
    selectedIds,
    toggleSelect,
    showCheckbox,
    cursorIndex,
  })
  renderRef.current = { onSelect, memberMap, selectedIds, toggleSelect, showCheckbox, cursorIndex }

  // oas-item 渲染通道必须先于 items 挂上（effect 按声明序执行）：
  // 切回视图时数据即刻就位，items setter 同步渲染，通道缺席则列表永远空白
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    ;(el as unknown as { 'item-height'?: number })['item-height'] = 44
    const onItem = (e: Event) => {
      const d = (e as CustomEvent<{ index: number; item: unknown; element: HTMLElement }>).detail
      const issue = d.item as Issue
      renderIssueRow(
        d.element,
        issue,
        renderRef.current.memberMap,
        renderRef.current.onSelect,
        renderRef.current.selectedIds,
        renderRef.current.toggleSelect,
        renderRef.current.showCheckbox,
        d.index === renderRef.current.cursorIndex,
      )
    }
    el.addEventListener('oas-item', onItem)
    // 记录滚动位置：items 更新后 scrollToIndex 恢复视口用
    const onScroll = (e: Event) => {
      lastTopRef.current = (e as CustomEvent<{ scrollTop: number }>).detail?.scrollTop ?? 0
    }
    el.addEventListener('oas-scroll', onScroll)
    return () => {
      el.removeEventListener('oas-item', onItem)
      el.removeEventListener('oas-scroll', onScroll)
    }
  }, [])

  // 组件对「同长度 items 引用更新」不自动重派 oas-item（筛选/切换项目场景列表空白）：
  // items 落库后 scrollToIndex 重算窗口强制重渲染，oas-scroll 记录的视口位置得以保持
  useEffect(() => {
    const el = listRef.current as
      | (HTMLElement & {
          items?: unknown[]
          scrollToIndex?: (i: number, o?: { align?: string }) => void
        })
      | null
    if (!el) return
    el.items = issues
    el.scrollToIndex?.(Math.round(lastTopRef.current / 44), { align: 'start' })
  }, [issues])

  useEffect(() => {
    if (cursorIndex < 0) return
    const el = listRef.current as
      | (HTMLElement & { scrollToIndex?: (i: number, o?: { align?: string }) => void })
      | null
    el?.scrollToIndex?.(cursorIndex, { align: 'nearest' })
  }, [cursorIndex])

  return (
    <oas-virtual-list
      ref={listRef}
      className="issue-scroll"
      data-testid="issue-vlist"
      style={{ flex: 1, minHeight: 0 }}
    />
  )
}
