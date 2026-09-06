// src/components/app-shell.tsx —— 布局壳：oas-layout + 头部 + 三形态导航 + 页签栏 + 面包屑 + footer
// NavMenu key 重挂载（保证 useOasEvent 绑定到新元素）；no-chrome 由路由层未登录分支天然接管
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useT } from '../hooks/use-t'
import { navConfig, type NavConfig } from '../layout-config'
import { appRoutes, matchRoute } from '../router/routes'
import { CommandPalette } from './command-palette'
import { HeaderBar } from './header-bar'
import { NavMenu } from './nav-menu'
import { routeHref } from '../router/mode'
import { NotificationsDrawer, useNotifications } from './notifications-drawer'
import { TabsBar } from './tabs-bar'

/** oas-sidebar 的抽屉方法（☰ 在 sidebar 形态下开关联抽屉） */
interface SidebarElement extends HTMLElement {
  openDrawer(): void
  closeDrawer(): void
}

interface CrumbItem {
  label: string
  href?: string
}

/** 面包屑 items：对齐 vanilla syncNav——根 + （父级） + 当前页，首页/未知路由两级无 href */
function buildCrumbs(activePath: string, t: (key: string) => string): CrumbItem[] {
  const route = matchRoute(activePath)
  const home = appRoutes[0]
  const rootLabel = t('nav.root')
  if (route === undefined || route.path === home.path) {
    return [{ label: rootLabel }, { label: t(home.meta.titleKey) }]
  }
  const items: CrumbItem[] = [{ label: rootLabel, href: routeHref(home.path) }]
  const parentPath = route.meta.parent
  const parent = parentPath ? matchRoute(parentPath) : undefined
  if (parent && parentPath) {
    items.push({ label: t(parent.meta.titleKey), href: routeHref(parentPath) })
  }
  items.push({ label: t(route.meta.titleKey) })
  return items
}

export function AppShell() {
  const { t } = useT()
  const location = useLocation()
  const activePath = location.pathname

  const [nav, setNav] = useState<NavConfig>(navConfig)
  const { style, position } = nav
  const navRef = useRef<HTMLElement | null>(null)
  const popoverNavRef = useRef<HTMLElement | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const notif = useNotifications()
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    const onChange = () => {
      setNav(navConfig())
      setPopoverOpen(false)
    }
    window.addEventListener('oas:navconfig-change', onChange)
    return () => window.removeEventListener('oas:navconfig-change', onChange)
  }, [])

  useEffect(() => {
    const route = matchRoute(activePath)
    document.title = route ? `${t(route.meta.titleKey)} · ${t('app.fullname')}` : t('app.fullname')
  }, [activePath, t])

  // ☰ 单击分派：sidebar 走自身抽屉；menubar/navigation 走悬浮菜单
  const onNavToggle = () => {
    const el = navRef.current
    if (el?.tagName === 'OAS-SIDEBAR') {
      const sidebar = el as SidebarElement
      if (sidebar.hasAttribute('drawer-open')) sidebar.closeDrawer()
      else sidebar.openDrawer()
    } else {
      setPopoverOpen((v) => !v)
    }
  }

  useEffect(() => {
    if (!popoverOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('#menu-popover') || target.closest('#nav-toggle')) return
      setPopoverOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [popoverOpen])

  const crumbs = useMemo(() => JSON.stringify(buildCrumbs(activePath, t)), [activePath, t])

  // 页面入场动画：首次渲染不加 page-enter，路由切换后 key 重挂载 <main> 自然重放动画
  const prevPathRef = useRef<string | null>(null)
  const isRouteSwitch = prevPathRef.current !== null && prevPathRef.current !== activePath
  useEffect(() => {
    prevPathRef.current = activePath
  }, [activePath])

  // 形态/位置变化时 key 重挂载 NavMenu，让 useOasEvent 绑定到新元素
  const navMenu = (vertical: boolean) => (
    <NavMenu
      key={`${style}:${position}:${vertical ? 'v' : 'h'}`}
      style={style}
      vertical={vertical}
      activePath={activePath}
      navRef={navRef}
    />
  )

  return (
    <>
      <oas-layout
        className="app"
        viewport
        side={position === 'top-head' ? 'top' : position}
        data-menu-style={style}
      >
        <HeaderBar
          onNavToggle={onNavToggle}
          onOpenCommand={() => setCommandOpen(true)}
          headerMenu={
            position === 'top-head' ? (
              <div className="header-nav-menubar">{navMenu(false)}</div>
            ) : undefined
          }
          notifCount={notif.unread}
          onToggleNotif={() => setNotifOpen((v) => !v)}
        />
        {position === 'top' && (
          <div className="top-nav-bar" slot="sider">
            {navMenu(false)}
          </div>
        )}
        {position !== 'top' && position !== 'top-head' && (
          <div slot="sider" className="nav-sider">
            {navMenu(true)}
          </div>
        )}
        <div slot="content" className="content-col">
          <TabsBar />
          <div className="crumbs-bar">
            <oas-breadcrumb id="crumbs" items={crumbs} />
          </div>
          <main id="view" key={activePath} className={isRouteSwitch ? 'page-enter' : undefined}>
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </main>
          <footer className="app-foot">{t('app.footer')}</footer>
        </div>
      </oas-layout>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <NotificationsDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={notif.items}
        onReadOne={notif.readOne}
        onReadAll={notif.readAll}
      />
      {popoverOpen && (
        <div id="menu-popover" className="menu-popover">
          <NavMenu
            style={style}
            vertical
            activePath={activePath}
            navRef={popoverNavRef}
            popover
            onNavigate={() => setPopoverOpen(false)}
          />
        </div>
      )}
    </>
  )
}
