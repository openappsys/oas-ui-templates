// src/components/nav-menu.tsx —— 导航菜单：sidebar / menubar / navigation 三形态 × 位置分派
//   高亮三机制——sidebar 用 active 属性；menubar 用 value 属性（radio ✓ 高亮）；
//   navigation 用 items 内 active 字段（value 必须留空，否则 findItem 落空面板空白）
// 形态/位置切换由调用方用 key 重挂载本组件，保证 useOasEvent 绑定到新元素
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import './nav-menu.css'
import { useOasEvent } from '../hooks/use-oas-event'
import { readSidebarCollapsed, writeSidebarCollapsed, type MenuStyle } from '../layout-config'
import { groupMenuItems, sidebarItems } from './nav-items'

export interface NavMenuProps {
  style: MenuStyle
  /** 竖排（left/right 槽位）或横排（top / top-head） */
  vertical: boolean
  activePath: string
  /** ☰ 按钮需要读取 nav 元素以分派 sidebar 抽屉/悬浮菜单，元素实例回写给 AppShell */
  navRef: React.MutableRefObject<HTMLElement | null>
  /** 浮层形态（☰ 弹出面板）：id 用 nav-popover，menubar 加 trigger="click" */
  popover?: boolean
  onNavigate?: () => void
}

export function NavMenu({
  style,
  vertical,
  activePath,
  navRef,
  popover,
  onNavigate,
}: NavMenuProps) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed())
  const id = popover ? 'nav-popover' : 'nav'

  useOasEvent<{ value: string }>(navRef, 'oas-select', (detail) => {
    const value = detail.value
    if (!value) return
    if (value !== activePath) navigate(value)
    onNavigate?.()
  })

  // 折叠持久化：仅 sidebar 形态有折叠（collapsed）
  useOasEvent<{ collapsed: boolean }>(navRef, 'oas-collapse', (detail) => {
    if (style !== 'sidebar') return
    if (typeof detail?.collapsed === 'boolean') {
      writeSidebarCollapsed(detail.collapsed)
      setCollapsed(detail.collapsed)
    }
  })

  // navigation 在浮层容器里首帧测量会坍缩成 0×0（oas-navigation-menu 浮层测量缺陷）：
  useEffect(() => {
    if (!popover || style !== 'navigation') return
    const raf = requestAnimationFrame(() => {
      navRef.current?.setAttribute('items', JSON.stringify(groupMenuItems(activePath, true)))
    })
    return () => cancelAnimationFrame(raf)
    // 仅挂载时兜底一次；activePath 变化由 React 正常重设 items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popover, style, navRef])

  if (style === 'menubar') {
    return (
      <oas-menubar
        id={id}
        ref={navRef as React.Ref<HTMLElement>}
        orientation={vertical ? 'vertical' : 'horizontal'}
        trigger={popover ? 'click' : undefined}
        items={JSON.stringify(groupMenuItems(activePath, false))}
        value={activePath}
      />
    )
  }
  if (style === 'navigation') {
    return (
      <oas-navigation-menu
        id={id}
        ref={navRef as React.Ref<HTMLElement>}
        orientation={vertical ? 'vertical' : 'horizontal'}
        items={JSON.stringify(groupMenuItems(activePath, true))}
      />
    )
  }
  return (
    <oas-sider id={popover ? undefined : 'nav-sider'}>
      <oas-sidebar
        id={id}
        ref={navRef as React.Ref<HTMLElement>}
        items={JSON.stringify(sidebarItems())}
        active={activePath}
        collapsed={collapsed}
      />
    </oas-sider>
  )
}
