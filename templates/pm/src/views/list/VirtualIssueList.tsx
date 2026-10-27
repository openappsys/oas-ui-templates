import { useEffect, useRef } from 'react'
import type { Issue, Member } from '@/types'
import { priorityLabel, statusLabel, t } from '@/i18n'
import { AVATAR_UNASSIGNED, PRIORITY_TEXT, STATUS_TEXT } from '@/lib/colors'

/** 行样式注入所在 shadow root（每次渲染幂等）：light CSS 不穿透，inline grid 在该容器不稳 */
function ensureRowStyles(root: ShadowRoot | null): void {
  if (!root || root.querySelector('style[data-issue-row]')) return
  const st = document.createElement('style')
  st.setAttribute('data-issue-row', '')
  st.textContent = `
    .issue-row {
      display: grid;
      grid-template-columns: 22px 110px minmax(0, 1fr) 96px 70px 90px;
      align-items: center;
      gap: 12px;
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
    .issue-row:focus-visible {
      outline: 2px solid var(--oas-color-primary, #0b6cff);
      outline-offset: -2px;
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
    .issue-row .review-badge {
      display: inline-block;
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 999px;
      border: 1px solid #f59e0b;
      color: #b45309;
      background: rgba(245, 158, 11, 0.12);
      font-size: 11px;
      line-height: 16px;
      vertical-align: middle;
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
      grid-template-columns: 110px minmax(0, 1fr) 96px 70px 90px;
    }
    .issue-row .issue-priority,
    .issue-row .issue-status {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .issue-row .issue-assignee {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .issue-row .issue-assignee-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      color: var(--oas-color-text-secondary, #6b7280);
    }
  `
  root.appendChild(st)
}

/** oas-virtual-list 宿主：items/scrollToIndex 是组件公共契约（property + 方法） */
type IssueListElement = HTMLElement & {
  items?: unknown[]
  scrollToIndex?: (i: number, o?: { align?: string }) => void
}

/** 行内焦点快照：testid 定位控件种类（行间重名，如每行都有 row-check），行 key 锁定是哪一行 */
interface RowFocusSnapshot {
  key: string
  testid: string
}

/** 行重建前的焦点落点：焦点不在行内（视口/外部控件）时返回 null，调用方据此跳过恢复 */
function captureRowFocus(el: IssueListElement): RowFocusSnapshot | null {
  const root = el.shadowRoot
  const active = root?.activeElement
  if (!root || !(active instanceof HTMLElement)) return null
  // 焦点在行内控件自己的 shadow 里（如 oas-checkbox 的内部 input）时，activeElement 已 retarget 到宿主
  const row = active.closest<HTMLElement>('.issue-row')
  const key = row?.dataset.key ?? ''
  if (!row || !key) return null
  // 带 testid 的最近祖先；closest 不跨 shadow 边界，不会误命中列表宿主的 testid
  const target = active.closest<HTMLElement>('[data-testid]')
  return { key, testid: target?.dataset.testid ?? '' }
}

/** 聚焦元素本体；宿主自定义元素自身不可聚焦时（oas-checkbox 的焦点在内部 input）钻进 shadow 找控件 */
function focusDeep(el: HTMLElement): void {
  el.focus({ preventScroll: true })
  const root = el.getRootNode()
  if (root instanceof ShadowRoot && root.activeElement === el) return
  el.shadowRoot
    ?.querySelector<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    ?.focus({ preventScroll: true })
}

/** 按行 key + 控件 testid 找回新节点并聚焦；行不在窗内（已筛选掉/滚出窗口）或无该控件时返回 false */
function restoreRowFocus(el: IssueListElement, snap: RowFocusSnapshot): boolean {
  const root = el.shadowRoot
  if (!root) return false
  // 行按下标复用的窗口会随数据漂移，只有 key 稳定（同 SideList 按 data-value 恢复）
  const row = root.querySelector<HTMLElement>(`.issue-row[data-key="${CSS.escape(snap.key)}"]`)
  if (!row) return false
  // 无 testid 的落点退回行本体（tabindex=0 可聚焦）
  const target = snap.testid
    ? row.querySelector<HTMLElement>(`[data-testid="${CSS.escape(snap.testid)}"]`)
    : row
  if (!target) return false
  focusDeep(target)
  return root.activeElement === target
}

/**
 * 重建后恢复焦点：scrollToIndex 改 scrollTop 还会触发一次 rAF 驱动的窗口重排（第二次整树重建），
 * 故不在重建的同一调用栈内落焦，而是下一帧尝试；首次未命中再补一帧，成功即停（最多两次）。
 * 行已不在窗内时静默放弃——不把焦点丢给列表容器，避免焦点从行内跳走。
 */
function scheduleRowFocusRestore(el: IssueListElement, snap: RowFocusSnapshot | null): void {
  if (!snap) return
  let tries = 2
  const tick = () => {
    if (restoreRowFocus(el, snap)) return
    tries -= 1
    if (tries > 0) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
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
  // 行身份锚点：焦点恢复只能按 key 找回（窗口下标随数据漂移，DOM 每次重建都是新节点）
  row.dataset.key = issue.key
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
  const titleSpan = add('issue-title', issue.title)
  // 待验收徽标挂在标题单元格内（行是固定列数 grid，append 到行会掉进隐式行被压没）
  if (issue.reviewRequired === true) {
    const badge = document.createElement('span')
    badge.className = 'review-badge'
    badge.setAttribute('data-testid', 'review-badge')
    badge.textContent = t('reviewBadge')
    titleSpan.appendChild(badge)
  }
  const m = memberMap.get(issue.assigneeId ?? '')
  const av = document.createElement('oas-avatar')
  av.setAttribute('size', '20')
  if (m) {
    av.setAttribute('color', m.avatarColor)
    av.title = m.name
    av.setAttribute('text', m.name[0])
  } else {
    av.setAttribute('color', AVATAR_UNASSIGNED)
    av.title = t('resourceUnassigned')
  }
  const asg = document.createElement('span')
  asg.className = 'issue-assignee'
  asg.appendChild(av)
  const asgName = document.createElement('span')
  asgName.className = 'issue-assignee-name'
  asgName.textContent = m?.name ?? t('resourceUnassigned')
  asg.appendChild(asgName)
  row.appendChild(asg)
  add(`issue-priority pri-${issue.priority}`, priorityLabel(issue.priority), {
    color: PRIORITY_TEXT[issue.priority],
  })
  add(`issue-status st-${issue.status}`, statusLabel(issue.status), {
    color: STATUS_TEXT[issue.status],
  })
  row.addEventListener('click', () => onSelect(issue.id))
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') onSelect(issue.id)
  })
  if (showCheckbox) {
    // 行首多选框：点击不触发行打开。
    // 行在 shadow 内，`.sr-only` 这类 light DOM 样式表不生效——可访问名用内联样式做到视觉隐藏，
    // 否则 200 个行内 checkbox 在可访问树里全是无名控件。
    const check = document.createElement('oas-checkbox')
    check.className = 'row-check'
    check.setAttribute('data-testid', 'row-check')
    check.setAttribute('size', 'small')
    check.toggleAttribute('checked', selectedIds.has(issue.id))
    const name = document.createElement('span')
    name.textContent = t('rowSelect').replace('{key}', issue.key)
    name.style.cssText =
      'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0'
    check.appendChild(name)
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
  onNearBottom,
  lang,
}: {
  issues: Issue[]
  onSelect: (id: string) => void
  memberMap: Map<string, Member>
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  showCheckbox: boolean
  cursorIndex: number
  onNearBottom: () => void
  lang: string
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
    onNearBottom,
    rowCount: issues.length,
  })
  renderRef.current = {
    onSelect,
    memberMap,
    selectedIds,
    toggleSelect,
    showCheckbox,
    cursorIndex,
    onNearBottom,
    rowCount: issues.length,
  }
  const nearRef = useRef(false)
  const lastExtendRef = useRef(0)

  // oas-item 渲染通道必须先于 items 挂上（effect 按声明序执行）：
  // 切回视图时数据即刻就位，items setter 同步渲染，通道缺席则列表永远空白
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    // 组件按 attribute 计算行高（默认 36）；必须与注入样式的行高 44 一致，
    // 否则滚动内容高与触底阈值错位，续载永远不会触发
    el.setAttribute('item-height', '44')
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
      const st = (e as CustomEvent<{ scrollTop: number }>).detail?.scrollTop ?? 0
      lastTopRef.current = st
      // 触底续载：接近已渲染内容底部时触发（进入 near 状态沿触发一次，数据落地后复位）
      const rowCount = renderRef.current.rowCount ?? 0
      if (rowCount === 0) return
      const contentH = rowCount * 44
      const viewportH = el.offsetHeight || 600
      const near = st + viewportH >= contentH - 900
      const now = Date.now()
      if (near && !nearRef.current && now - lastExtendRef.current > 800) {
        lastExtendRef.current = now
        renderRef.current.onNearBottom()
      }
      nearRef.current = near
    }
    el.addEventListener('oas-scroll', onScroll)
    return () => {
      el.removeEventListener('oas-item', onItem)
      el.removeEventListener('oas-scroll', onScroll)
    }
  }, [])

  // 组件对「同长度 items 引用更新」不自动重派 oas-item（筛选/切换项目场景列表空白）：
  // items 落库后 scrollToIndex 重算窗口强制重渲染，oas-scroll 记录的视口位置得以保持
  // biome-ignore lint/correctness/useExhaustiveDependencies: lang 变化需重推 items 触发行按新语言重渲染（行内 t()/statusLabel 读模块级语言态）
  useEffect(() => {
    const el = listRef.current as IssueListElement | null
    if (!el) return
    // 重建会替换行 DOM：先记账再推数据（他处改状态触发 liveQuery 时键盘/鼠标焦点不丢）
    const snap = captureRowFocus(el)
    el.items = issues
    el.scrollToIndex?.(Math.round(lastTopRef.current / 44), { align: 'start' })
    scheduleRowFocusRestore(el, snap)
  }, [issues, lang])

  // 成员/多选权限晚于首个渲染窗口就绪（API 模式异步取成员）：行只在 oas-item 时取当前
  // props，props 后续变化不会自动重派——补一次强制重渲染，修「整列灰色 ? + 勾选列缺失」
  // biome-ignore lint/correctness/useExhaustiveDependencies: memberMap/showCheckbox 只作重渲染触发器（effect 体不引用它们）
  useEffect(() => {
    const el = listRef.current as IssueListElement | null
    if (!el) return
    const snap = captureRowFocus(el)
    el.scrollToIndex?.(Math.round(lastTopRef.current / 44), { align: 'start' })
    scheduleRowFocusRestore(el, snap)
  }, [memberMap, showCheckbox])

  // 选中集是受控数据（表头全选一次改一批）：行 DOM 只在 oas-item 时创建，勾选态不会自己跟随。
  // 这里按行 key 就地同步 checked 属性（不重建行，避免打断连续勾选与焦点）
  useEffect(() => {
    const root = listRef.current?.shadowRoot
    if (!root) return
    const byKey = new Map(issues.map((i) => [i.key, i.id]))
    for (const row of root.querySelectorAll<HTMLElement>('.issue-row')) {
      const id = byKey.get(row.dataset.key ?? '')
      const check = row.querySelector<HTMLElement>('.row-check')
      if (!check || id === undefined) continue
      const want = selectedIds.has(id)
      if (check.hasAttribute('checked') !== want) check.toggleAttribute('checked', want)
    }
  }, [selectedIds, issues])

  // 渲染窗高 = height 属性（缺省 320，不测宿主布局）——ResizeObserver 把宿主实际
  // 高度实时写入，虚拟窗口随视口伸缩（修「只渲染 9 行后大片空白」）
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const sync = () => {
      const h = Math.round(el.getBoundingClientRect().height)
      if (h > 0) el.setAttribute('height', String(h))
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (cursorIndex < 0) return
    const el = listRef.current as IssueListElement | null
    el?.scrollToIndex?.(cursorIndex, { align: 'auto' })
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
