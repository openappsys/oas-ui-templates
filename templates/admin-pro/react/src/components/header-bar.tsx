// src/components/header-bar.tsx —— 顶栏：☰/logo/（top-head 菜单槽）/搜索/全屏/主题点/语言/通知 badge/用户菜单
// 结构、id、类名逐字对齐 vanilla app-shell.ts 的 <header class="app-header"> 模板
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { toggleTheme } from '../lib/theme'
import { logoutFlow } from '../lib/session-actions'
import { session } from '../store/session'
import { LANG_ITEMS, userMenuItems } from './nav-items'

const EXPAND_ICON = (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5" />
    <path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5" />
    <path d="M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11" />
    <path d="M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11" />
  </svg>
)
const COMPRESS_ICON = (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M2 5h3V2" />
    <path d="M14 5h-3V2" />
    <path d="M14 11h-3v3" />
    <path d="M2 11h3v3" />
  </svg>
)
const BELL_ICON = (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 2.2a3.6 3.6 0 0 1 3.6 3.6c0 2.2.5 3.4 1.5 4.4H2.9c1-1 1.5-2.2 1.5-4.4A3.6 3.6 0 0 1 8 2.2z" />
    <path d="M6.7 12.4a1.4 1.4 0 0 0 2.6 0" />
  </svg>
)
const GLOBE_ICON = (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M2 8h12" />
    <path d="M8 2c2 1.7 3 3.8 3 6s-1 4.3-3 6c-2-1.7-3-3.8-3-6s1-4.3 3-6z" />
  </svg>
)

function safeFullscreen(p: Promise<void> | undefined): void {
  if (p && typeof p.catch === 'function') p.catch(() => {})
}

export interface HeaderBarProps {
  /** ☰ 单击：sidebar 开抽屉 / menubar·navigation 开悬浮菜单（由 AppShell 分派） */
  onNavToggle: () => void
  /** 搜索框单击/Enter：唤起命令面板 */
  onOpenCommand: () => void
  /** top-head 位置时塞在 logo 与搜索框之间的菜单节点 */
  headerMenu?: React.ReactNode
  notifCount: number
  onToggleNotif: () => void
}

export function HeaderBar({
  onNavToggle,
  onOpenCommand,
  headerMenu,
  notifCount,
  onToggleNotif,
}: HeaderBarProps) {
  const { t, locale, setLocale } = useT()
  const navigate = useNavigate()
  const user = useSyncExternalStore(session.subscribe, () => session.user)
  const langMenuRef = useRef<HTMLElement>(null)
  const userMenuRef = useRef<HTMLElement>(null)
  const badgeRef = useRef<HTMLElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // 全屏可用性挂载时判定一次即可（vanilla: fullscreenEnabled 不支持则隐藏按钮）
  const [fsSupported] = useState(() => document.fullscreenEnabled)

  // 语言下拉：选择即切换 locale（useT 订阅令全壳重渲染，各 items/文案随之刷新）
  useOasEvent<{ value: string }>(langMenuRef, 'oas-select', (detail) => {
    if (detail.value === 'zh-CN' || detail.value === 'en') setLocale(detail.value)
  })

  // 用户下拉：个人中心 / 登出
  useOasEvent<{ value: string }>(userMenuRef, 'oas-select', (detail) => {
    if (detail.value === 'logout') logoutFlow(navigate)
    else if (detail.value === '/profile') navigate(detail.value)
  })

  // 全屏态同步（Esc 退出等浏览器侧变更也要回写 aria-pressed / is-fullscreen）
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // 未读数变化时 badge 弹跳（vanilla syncBadge 的 is-pop 重触发动画）
  const lastCountRef = useRef(-1)
  useEffect(() => {
    const el = badgeRef.current
    if (!el || notifCount === lastCountRef.current) return
    lastCountRef.current = notifCount
    el.classList.remove('is-pop')
    void el.offsetWidth
    el.classList.add('is-pop')
  }, [notifCount])

  return (
    <header className="app-header" slot="header">
      <oas-button
        id="nav-toggle"
        className="nav-toggle"
        type="text"
        icon="menu"
        aria-label={t('header.openMenu')}
        onClick={onNavToggle}
      />
      <span className="oas-logo">
        <span className="oas-logo-badge">OAS</span>
        <span className="oas-logo-word">OAS Admin Pro</span>
      </span>
      {headerMenu}
      <span className="spacer" />
      <div className="global-search">
        <oas-input
          id="global-search"
          placeholder={t('header.search')}
          prefix-icon="search"
          readonly
          onPointerDown={(e) => e.preventDefault()}
          onClick={onOpenCommand}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            onOpenCommand()
          }}
        />
        <span className="kbd-hint">/</span>
      </div>
      <span className="spacer" />
      <button
        id="fullscreen-toggle"
        className={`icon-btn fullscreen-btn${isFullscreen ? ' is-fullscreen' : ''}`}
        type="button"
        title={t('header.fullscreen')}
        aria-label={t('header.fullscreen')}
        aria-pressed={isFullscreen}
        hidden={!fsSupported}
        onClick={() => {
          if (document.fullscreenElement) safeFullscreen(document.exitFullscreen())
          else safeFullscreen(document.documentElement.requestFullscreen())
        }}
      >
        <oas-icon size="18" className="fs-expand">
          {EXPAND_ICON}
        </oas-icon>
        <oas-icon size="18" className="fs-compress">
          {COMPRESS_ICON}
        </oas-icon>
      </button>
      <button
        id="theme-toggle"
        className="theme-dot"
        type="button"
        title={t('header.theme')}
        aria-label={t('header.theme')}
        onClick={toggleTheme}
      />
      <oas-dropdown
        id="lang-menu"
        ref={langMenuRef as React.Ref<HTMLElement>}
        placement="bottom"
        arrow-point-at-center
        trigger="hover click"
        value={locale}
        items={LANG_ITEMS}
      >
        <button
          id="lang-toggle"
          className="icon-btn"
          type="button"
          title={t('cmd.locale')}
          aria-label={t('cmd.locale')}
          aria-haspopup="menu"
        >
          <oas-icon size="18">{GLOBE_ICON}</oas-icon>
        </button>
      </oas-dropdown>
      <oas-badge
        id="notif-badge"
        ref={badgeRef as React.Ref<HTMLElement>}
        value={String(notifCount)}
        size="small"
        offset="-2,2"
      >
        <button
          id="notif-toggle"
          className="icon-btn"
          type="button"
          title={t('header.notification')}
          aria-label={t('header.notificationCount', { count: notifCount })}
          onClick={onToggleNotif}
        >
          <oas-icon size="18">{BELL_ICON}</oas-icon>
        </button>
      </oas-badge>
      <oas-dropdown
        id="user-menu"
        ref={userMenuRef as React.Ref<HTMLElement>}
        placement="bottom"
        arrow-point-at-center
        trigger="hover click"
        items={userMenuItems()}
      >
        <oas-avatar
          id="user-avatar"
          size="28"
          text={(user?.name ?? '').charAt(0).toUpperCase()}
          aria-label={t('header.userMenu')}
          aria-haspopup="menu"
        />
      </oas-dropdown>
    </header>
  )
}
