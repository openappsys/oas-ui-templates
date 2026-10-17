import { useEffect, useMemo, useRef } from 'react'
import { db } from '@/db/schema'
import type { Issue, IssueStatus, Member } from '@/types'
import { ISSUE_STATUSES, STATUS_LABEL } from '@/types'
import { betweenOrder } from '@/lib/order'

/* ── 看板（oas-kanban：拖拽/多选/键盘/触屏全部组件库内建） ── */
interface KanbanElement extends HTMLElement {
  columns?: unknown
  cards?: Array<Record<string, unknown>>
  renderCard?: ((card: Record<string, unknown>) => Node | string) | null
}

export function KanbanBoard({
  issues,
  memberMap,
  onOpenIssue,
}: {
  issues: Issue[]
  memberMap: Map<string, Member>
  onOpenIssue: (id: string) => void
}) {
  const boardRef = useRef<KanbanElement>(null)
  const onOpenIssueRef = useRef(onOpenIssue)
  onOpenIssueRef.current = onOpenIssue

  const columns = useMemo(() => ISSUE_STATUSES.map((s) => ({ key: s, title: STATUS_LABEL[s] })), [])

  // 列内显示顺序 = cards 数组序：按 order 升序铺入
  const cards = useMemo(
    () =>
      [...issues]
        .sort((a, b) => a.order - b.order)
        .map((i) => ({
          id: i.id,
          column: i.status,
          title: i.title,
          order: i.order,
          key: i.key,
          priority: i.priority,
          assigneeId: i.assigneeId ?? '',
        })),
    [issues],
  )

  // renderCard/数据走 property 通道；拖放后组件内存持有，宿主经 oas-change 落库
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    el.columns = columns
    el.cards = cards
    el.renderCard = (card) => {
      const wrap = document.createElement('div')
      wrap.className = 'kb-card'
      wrap.style.cursor = 'pointer'
      wrap.addEventListener('click', (e) => {
        e.stopPropagation()
        onOpenIssueRef.current(String(card.id ?? ''))
      })
      const top = document.createElement('div')
      top.className = 'board-card-top'
      const k = document.createElement('span')
      k.className = 'board-card-key'
      k.textContent = String(card.key ?? '')
      top.appendChild(k)
      const m = memberMap.get(String(card.assigneeId ?? ''))
      const av = document.createElement('span')
      if (m) {
        av.className = 'avatar'
        av.style.background = m.avatarColor
        av.textContent = m.name[0]
      } else {
        av.className = 'avatar avatar-empty'
        av.textContent = '?'
      }
      top.appendChild(av)
      const t = document.createElement('p')
      t.className = 'board-card-title'
      t.textContent = String(card.title ?? '')
      const pr = document.createElement('span')
      pr.className = `issue-priority pri-${String(card.priority ?? '')}`
      pr.textContent = String(card.priority ?? '')
      wrap.append(top, t, pr)
      return wrap
    }
  }, [columns, cards, memberMap])

  // oas-change（from/to/index/ids）→ 落点前后卡 order 取中值落库（status 变更/列内排序统一）
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const onChange = (e: Event) => {
      const d = (
        e as CustomEvent<{
          id: string
          from: string
          to: string
          index: number
          ids?: string[]
        }>
      ).detail
      if (!d?.id || !d.to) return
      const to = d.to as IssueStatus
      const ids = d.ids ?? [d.id]
      const colCards = (el.cards ?? []).filter((c) => c.column === to)
      const moving = colCards.filter((c) => ids.includes(String(c.id)))
      const rest = colCards.filter((c) => !ids.includes(String(c.id)))
      const finalArr = [...rest]
      finalArr.splice(Math.min(d.index, finalArr.length), 0, ...moving)
      void db.transaction('rw', db.issues, async () => {
        const now = Date.now()
        for (const iid of ids) {
          const pos = finalArr.findIndex((c) => String(c.id) === iid)
          const prevOrder = pos > 0 ? (finalArr[pos - 1].order as number) : undefined
          const nextOrder =
            pos < finalArr.length - 1 ? (finalArr[pos + 1].order as number) : undefined
          await db.issues.update(iid, {
            status: to,
            order: betweenOrder(prevOrder, nextOrder),
            updatedAt: now,
          })
        }
      })
    }
    el.addEventListener('oas-change', onChange)
    return () => el.removeEventListener('oas-change', onChange)
  }, [])

  return (
    <div className="board">
      <oas-kanban ref={boardRef} data-testid="board" />
    </div>
  )
}
