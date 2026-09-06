// src/components/command-palette.tsx —— 命令面板：Ctrl/Cmd+K、/ 唤起；页面 + 操作 + 主题组
// 对齐 vanilla app-shell.ts buildCommandItems()/execCommand()/openCommand()/toggleCommand()
// open 状态由 AppShell 持有（头部搜索框也要唤起）。
// 关键差异（vs vanilla）：close-on-select="false"，选中后由 React 自己关面板——
// 实测组件在 oas-select 同一同步栈里自行 close() 时，open-change 派发的 setState 与
// execCommand 内 navigate() 触发的同步渲染交错，更新会被 React 丢弃（状态滞留 true 而
// 属性已被组件移除，永久失同步）。改为：select handler 里先 onOpenChange(false) 再 execCommand，
// 保证 setState 先于 navigate 入队；Esc/遮罩的组件自闭仍经 oas-open-change 微任务回写。
import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { logoutFlow } from '../lib/session-actions'
import { setTheme, toggleTheme } from '../lib/theme'
import { session } from '../store/session'
import { buildCommandItems } from './nav-items'

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { locale, setLocale } = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const commandRef = useRef<HTMLElement>(null)

  // locale 变化时重建 items（文案与 keywords 均含翻译）
  const items = useMemo(() => JSON.stringify(buildCommandItems()), [locale])

  useOasEvent<{ open: boolean }>(commandRef, 'oas-open-change', (detail) => {
    // 同步栈内直接 setState 会被 navigate 触发的渲染吞吐覆盖（实测丢失）：
    // 组件在 oas-select 的同一同步栈里 close() → 本事件与路由渲染交错 → 更新被丢弃，
    // 状态滞留 true 而属性已被组件移除（失同步）。微任务延后到同步栈外落地。
    const next = detail.open
    queueMicrotask(() => onOpenChange(next))
  })

  useOasEvent<{ value: string }>(commandRef, 'oas-select', (detail) => {
    // 先关面板（setState 先于 navigate 入队，避免与路由同步渲染交错丢失），再执行命令
    onOpenChange(false)
    execCommand(detail.value)
  })

  function execCommand(value: string): void {
    if (value.startsWith('/')) {
      // vanilla 同路径 resolve() 重渲当前页；React 同路径导航 no-op，不重挂载
      if (value !== location.pathname) navigate(value)
      return
    }
    if (value === 'action:theme') {
      toggleTheme()
    } else if (value === 'action:refresh') {
      window.location.reload()
    } else if (value === 'action:logout') {
      logoutFlow(navigate)
    } else if (value === 'action:locale') {
      setLocale(locale === 'en' ? 'zh-CN' : 'en')
    } else if (value.startsWith('theme:')) {
      setTheme(value)
    }
  }

  // 全局快捷键：Ctrl/Cmd+K 切换、/ 唤起（输入类控件内不劫持）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (session.user) onOpenChange(!open)
        return
      }
      if (e.key !== '/' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"], oas-input, oas-select')
      )
        return
      e.preventDefault()
      if (session.user) onOpenChange(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  return (
    <oas-command
      id="command"
      ref={commandRef as React.Ref<HTMLElement>}
      hotkey="false"
      close-on-select="false"
      items={items}
      open={open}
    />
  )
}
