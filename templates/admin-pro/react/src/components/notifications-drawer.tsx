// src/components/notifications-drawer.tsx —— 通知中心抽屉 + 通知数据状态 hook
// 状态由 AppShell 经 useNotifications() 持有一份，badge（header-bar）与抽屉共享
// 注意：oas-drawer 内部 panel 对 click stopPropagation（mask 点击关闭的配套），
import { useCallback, useEffect, useRef, useState } from 'react'
import { listNotifications, markAllRead, markRead, type Notification } from '../data/notifications'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'

/** 通知数据状态：list/markRead/markAllRead 是裸数据模块（无订阅），动作后重读列表驱动重渲染 */
export function useNotifications() {
  const [items, setItems] = useState<Notification[]>(listNotifications)
  const refresh = useCallback(() => setItems(listNotifications()), [])
  const readOne = useCallback(
    (id: string) => {
      markRead(id)
      refresh()
    },
    [refresh],
  )
  const readAll = useCallback(() => {
    markAllRead()
    refresh()
  }, [refresh])
  const unread = items.filter((n) => !n.read).length
  return { items, unread, readOne, readAll }
}

export interface NotificationsDrawerProps {
  open: boolean
  onClose: () => void
  items: Notification[]
  onReadOne: (id: string) => void
  onReadAll: () => void
}

export function NotificationsDrawer({
  open,
  onClose,
  items,
  onReadOne,
  onReadAll,
}: NotificationsDrawerProps) {
  const { t } = useT()
  const drawerRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLElement>(null)
  const readAllRef = useRef<HTMLButtonElement>(null)
  const allRead = items.every((n) => n.read)

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态，保持 visible 属性单一事实来源
  useOasEvent(drawerRef, 'oas-close', () => onClose())

  // 回调最新化：原生监听只在挂载时绑一次，避免 items 变化反复解绑
  const onReadOneRef = useRef(onReadOne)
  onReadOneRef.current = onReadOne
  const onReadAllRef = useRef(onReadAll)
  onReadAllRef.current = onReadAll

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const onClick = (e: Event) => {
      const item = (e.target as HTMLElement).closest('oas-list-item')
      const id = item?.getAttribute('data-id')
      if (id) onReadOneRef.current(id)
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    const el = readAllRef.current
    if (!el) return
    const onClick = () => onReadAllRef.current()
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [])

  return (
    <oas-drawer
      id="notif-drawer"
      ref={drawerRef as React.Ref<HTMLElement>}
      title={t('header.notification')}
      placement="right"
      size="medium"
      no-footer
      visible={open}
    >
      <div className="notif-content">
        <div id="notif-list" className="notif-list">
          <oas-list split ref={listRef as React.Ref<HTMLElement>}>
            {items.map((n) => (
              <oas-list-item
                key={n.id}
                className={`notif-item${n.read ? '' : ' is-unread'}`}
                title={n.title}
                data-id={n.id}
              >
                <span slot="description" className="notif-desc">
                  {n.desc}
                </span>
                <span slot="extra" className="notif-meta">
                  <span className="notif-time">{n.time}</span>
                </span>
              </oas-list-item>
            ))}
          </oas-list>
        </div>
        <div className="notif-foot">
          <button
            id="notif-readall"
            ref={readAllRef}
            className="link-btn"
            type="button"
            disabled={allRead}
          >
            {allRead ? t('header.allReadDone') : t('header.allRead')}
          </button>
        </div>
      </div>
    </oas-drawer>
  )
}
