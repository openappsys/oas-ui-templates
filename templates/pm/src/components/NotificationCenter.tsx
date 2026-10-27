import { useEffect, useMemo, useState, type RefObject } from 'react'
import type { Issue, Member, Notification } from '@/types'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { relativeTime, statusLabel, t } from '@/i18n'
import { NOTIFICATION_LIMIT } from '@/lib/notify'

/** 类型图标走 oas-icon 内置 registry；cycle/system 预留给后续产生规则 */
const TYPE_ICON: Record<Notification['type'], string> = {
  mention: 'mail',
  assigned: 'user',
  comment: 'form',
  status: 'check-circle',
  cycle: 'clock',
  review: 'check-circle',
  system: 'info',
}

/** 通知正文：actor + issue key 由当前语言与成员表派生，语言切换时自动换文案。
 *  message 按 type 解释：mention/comment 是评论摘要，status 是状态码 */
function describe(n: Notification, issue: Issue | undefined, memberMap: Map<string, Member>) {
  const actor = memberMap.get(n.actorId ?? '')?.name ?? t('actorUnknown')
  const key = n.issueId ? (issue?.key ?? t('notifyIssueGone')) : ''
  const fill = (template: string) => template.replace('{actor}', actor).replace('{key}', key)
  switch (n.type) {
    case 'assigned':
      return { text: fill(t('notifyAssigned')) }
    case 'mention':
      return { text: fill(t('notifyMention')), snippet: n.message }
    case 'comment':
      return { text: fill(t('notifyComment')), snippet: n.message }
    case 'status':
      return {
        text: fill(t('notifyStatus')).replace('{status}', n.message ? statusLabel(n.message) : ''),
      }
    case 'cycle':
      return { text: t('notifyCycle').replace('{name}', n.message ?? '') }
    case 'review':
      return { text: fill(t('notifyReview')) }
    default:
      return { text: n.message || t('notifySystem') }
  }
}

/** 顶栏铃铛：未读角标 0 时隐藏（角标内的数字是「当前未读条数」） */
export function NotificationBell({
  currentUser,
  onOpen,
}: {
  currentUser: string
  onOpen: () => void
}) {
  const { notifications } = useRepositories()
  const unread =
    useObservable(() => notifications.unreadCount(currentUser), [notifications, currentUser]) ?? 0
  return (
    <oas-button
      type="text"
      size="small"
      className="tb-bell-btn"
      data-testid="toolbar-notify"
      title={t('notifyTitle')}
      aria-label={t('notifyTitle')}
      onClick={onOpen}
    >
      <svg
        className="tb-bell"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M8 2.2a3.6 3.6 0 0 0-3.6 3.6v2.3L3.2 10.6h9.6L11.6 8.1V5.8A3.6 3.6 0 0 0 8 2.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.6 12.6a1.4 1.4 0 0 0 2.8 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      {unread > 0 && (
        <oas-badge type="danger" data-testid="notify-badge">
          {unread > 99 ? '99+' : String(unread)}
        </oas-badge>
      )}
    </oas-button>
  )
}

/** 右侧通知面板（oas-drawer）：列表项点击 = 标已读 + 打开对应 Issue 详情 */
export function NotificationPanel({
  drawerRef,
  currentUser,
  memberMap,
  onOpenIssue,
}: {
  drawerRef: RefObject<HTMLElement | null>
  currentUser: string
  memberMap: Map<string, Member>
  onOpenIssue: (issueId: string) => void
}) {
  const { notifications, issues: issuesRepo } = useRepositories()
  const rows = useObservable(
    () => notifications.liveFor(currentUser, NOTIFICATION_LIMIT),
    [notifications, currentUser],
  )
  const unread =
    useObservable(() => notifications.unreadCount(currentUser), [notifications, currentUser]) ?? 0
  const [issueMap, setIssueMap] = useState<Map<string, Issue>>(new Map())

  // 通知行只存 issueId：一次 bulkGet 取齐 key（逐条 get 会让面板首开抖动）
  const issueIds = useMemo(
    () => [
      ...new Set((rows ?? []).map((r) => r.issueId).filter((id): id is string => Boolean(id))),
    ],
    [rows],
  )
  const issueIdsKey = issueIds.join(',')
  // biome-ignore lint/correctness/useExhaustiveDependencies: issueIds 由 issueIdsKey 派生，用 key 触发避免每次渲染重取
  useEffect(() => {
    if (issueIds.length === 0) {
      setIssueMap(new Map())
      return
    }
    let alive = true
    issuesRepo
      .bulkGet(issueIds)
      .then((list) => {
        if (!alive) return
        const map = new Map<string, Issue>()
        for (const issue of list) if (issue) map.set(issue.id, issue)
        setIssueMap(map)
      })
      .catch((e) => console.error('[notifications: issues]', (e as Error)?.message ?? e))
    return () => {
      alive = false
    }
  }, [issueIdsKey, issuesRepo])

  const openItem = async (n: Notification) => {
    if (n.readAt === null) void notifications.markRead(n.id)
    drawerRef.current?.removeAttribute('visible')
    if (!n.issueId) return
    try {
      // Issue 已删除（行还在）：只标已读，不开空抽屉；先查一次库而不是依赖面板首次 bulkGet 的时序
      const issue = issueMap.get(n.issueId) ?? (await issuesRepo.get(n.issueId))
      if (issue) onOpenIssue(n.issueId)
    } catch (e) {
      console.error('[notifications: open]', (e as Error)?.message ?? e)
    }
  }

  const empty = rows !== undefined && rows.length === 0
  return (
    <oas-drawer ref={drawerRef} no-footer data-testid="notify-drawer">
      <div className="notify-panel">
        <div className="notify-head">
          <h2 className="notify-heading">{t('notifyTitle')}</h2>
          <oas-button
            type="text"
            size="small"
            data-testid="notify-read-all"
            disabled={unread === 0}
            onClick={() => void notifications.markAllRead(currentUser)}
          >
            {t('notifyReadAll')}
          </oas-button>
        </div>
        {empty ? (
          <oas-empty description={t('notifyEmpty')} data-testid="notify-empty" />
        ) : (
          <div className="notify-list" data-testid="notify-list">
            {(rows ?? []).map((n) => {
              // 正文随语言/成员名派生；issue 未加载时先显示「Issue 已删除」占位
              const { text, snippet } = describe(n, issueMap.get(n.issueId ?? ''), memberMap)
              const unreadItem = n.readAt === null
              return (
                // biome-ignore lint/a11y/useSemanticElements: 行内含块级文案与预览，按钮语义由 role 提供
                <div
                  key={n.id}
                  className={`notify-item${unreadItem ? ' is-unread' : ' is-read'}`}
                  data-testid="notify-item"
                  data-type={n.type}
                  data-read={unreadItem ? 'false' : 'true'}
                  role="button"
                  tabIndex={0}
                  onClick={() => openItem(n)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openItem(n)
                    }
                  }}
                >
                  <span className="notify-type" aria-hidden="true">
                    <oas-icon name={TYPE_ICON[n.type]} size={14} />
                  </span>
                  <div className="notify-body">
                    <p className="notify-text">{text}</p>
                    {snippet && <p className="notify-snippet">{snippet}</p>}
                    <p className="notify-time">{relativeTime(n.createdAt)}</p>
                  </div>
                  {unreadItem && (
                    <span
                      className="notify-dot"
                      data-testid="notify-unread-dot"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </oas-drawer>
  )
}
