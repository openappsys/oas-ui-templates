import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useRepositories } from '@/data/context'
import type { Issue, IssueStatus, Member } from '@/types'
import { ISSUE_STATUSES } from '@/types'
import { getLang, statusLabel, t } from '@/i18n'
import { betweenOrder } from '@/lib/order'
import { AVATAR_UNASSIGNED } from '@/lib/colors'
import type { Action, Ctx } from '@/permission/policy'

/* ── 看板（oas-kanban：拖拽/多选/键盘/触屏全部组件库内建） ── */
interface KanbanElement extends HTMLElement {
  columns?: unknown
  cards?: Array<Record<string, unknown>>
  renderCard?: ((card: Record<string, unknown>) => Node | string) | null
}

export function KanbanBoard({
  issues,
  subProgress,
  memberMap,
  onOpenIssue,
  can,
}: {
  issues: Issue[]
  subProgress?: Map<string, { done: number; total: number }>
  memberMap: Map<string, Member>
  onOpenIssue: (id: string) => void
  can: (action: Action, ctx?: Ctx) => boolean
}) {
  const { issues: issuesRepo } = useRepositories()
  const boardRef = useRef<KanbanElement>(null)
  const onOpenIssueRef = useRef(onOpenIssue)
  onOpenIssueRef.current = onOpenIssue

  const lang = getLang()
  // biome-ignore lint/correctness/useExhaustiveDependencies: statusLabel() 读模块级语言态，lang 是语言切换时的重算触发器
  const columns = useMemo(
    () => ISSUE_STATUSES.map((s) => ({ key: s, title: statusLabel(s) })),
    [lang],
  )

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

  const issueMap = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues])
  const gateRef = useRef({ can, issueMap })
  gateRef.current = { can, issueMap }

  const canDragCard = useCallback((id: string): boolean => {
    const it = gateRef.current.issueMap.get(id)
    return it ? gateRef.current.can('issue:change-status', { issue: it }) : false
  }, [])

  // renderCard/数据走 property 通道；拖放后组件内存持有，宿主经 oas-change 落库
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    el.columns = columns
    el.cards = cards
    el.renderCard = (card) => {
      const wrap = document.createElement('div')
      wrap.className = 'kb-card'
      const draggable = canDragCard(String(card.id ?? ''))
      wrap.style.cursor = draggable ? 'pointer' : 'default'
      if (!draggable) {
        wrap.addEventListener('pointerdown', (e) => {
          e.preventDefault()
          e.stopPropagation()
        })
      }
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
      const av = document.createElement('oas-avatar')
      av.setAttribute('size', '18')
      if (m) {
        av.setAttribute('color', m.avatarColor)
        av.title = m.name
        av.setAttribute('text', m.name[0])
      } else {
        av.setAttribute('color', AVATAR_UNASSIGNED)
        av.title = t('resourceUnassigned')
      }
      top.appendChild(av)
      const title = document.createElement('p')
      title.className = 'board-card-title'
      title.textContent = String(card.title ?? '')
      const pr = document.createElement('span')
      pr.className = `issue-priority pri-${String(card.priority ?? '')}`
      pr.textContent = String(card.priority ?? '')
      const sp = subProgress?.get(String(card.id ?? ''))
      if (sp && sp.total > 0) {
        const chip = document.createElement('span')
        chip.className = 'sub-progress'
        chip.innerHTML = `<span class="sub-progress-bar"><span class="sub-progress-bar-fill" style="width:${Math.round((sp.done / sp.total) * 100)}%"></span></span>${sp.done}/${sp.total}`
        wrap.append(top, title, pr, chip)
      } else {
        wrap.append(top, title, pr)
      }
      return wrap
    }
  }, [columns, cards, memberMap, canDragCard])

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
      const ids = (d.ids ?? [d.id]).filter((iid) => canDragCard(iid))
      if (ids.length === 0) return
      const colCards = (el.cards ?? []).filter((c) => c.column === to)
      const moving = colCards.filter((c) => ids.includes(String(c.id)))
      const rest = colCards.filter((c) => !ids.includes(String(c.id)))
      const finalArr = [...rest]
      finalArr.splice(Math.min(d.index, finalArr.length), 0, ...moving)
      const updates = ids.map((iid) => {
        const pos = finalArr.findIndex((c) => String(c.id) === iid)
        const prevOrder = pos > 0 ? (finalArr[pos - 1].order as number) : undefined
        const nextOrder =
          pos < finalArr.length - 1 ? (finalArr[pos + 1].order as number) : undefined
        return {
          id: iid,
          changes: {
            status: to,
            order: betweenOrder(prevOrder, nextOrder),
            completedAt: to === 'done' ? Date.now() : null,
          },
        }
      })
      void issuesRepo.updateMany(updates)
    }
    el.addEventListener('oas-change', onChange)
    return () => el.removeEventListener('oas-change', onChange)
  }, [canDragCard, issuesRepo.updateMany])

  return (
    <div className="board">
      {/* 看板自身没有可见标题（列标题来自组件）：给视图补一个只读屏可见的一级标题，避免 main 下无标题 */}
      <h1 className="sr-only">{t('board')}</h1>
      <oas-kanban ref={boardRef} data-testid="board" />
    </div>
  )
}
