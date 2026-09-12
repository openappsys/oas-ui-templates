<script lang="ts">
  // src/components/command-palette.svelte —— 命令面板：Ctrl/Cmd+K、/ 唤起；页面 + 操作 + 主题组
  // open 状态由 AppShell 持有（头部搜索框也要唤起）。
  // 组件在 oas-select 同一同步栈里自行 close() 时，open-change 派发的状态回写与 execCommand 内
  // 路由导航触发的同步渲染交错会丢更新；改为 select handler 里先回写关面板再 execCommand，
  // Esc/遮罩的组件自闭仍经 oas-open-change 微任务回写。
  import { currentLocale } from '../i18n'
  import { logoutFlow } from '../lib/session-actions'
  import { setTheme, toggleTheme } from '../lib/theme'
  import { useT } from '../lib/use-t.svelte'
  import { currentPath, navigate } from '../router'
  import { fromStore } from 'svelte/store'
  import { session } from '../store/session'
  import { buildCommandItems } from './nav-items'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
  }

  let { open, onOpenChange }: Props = $props()

  const { locale, setLocale } = useT()
  const path = fromStore(currentPath)

  // locale 变化时重建 items（文案与 keywords 均含翻译）
  const items = $derived.by(() => {
    void $locale
    return JSON.stringify(buildCommandItems())
  })

  function onOpenChangeEvent(e: Event): void {
    // 同步栈内直接回写会与 navigate 触发的渲染交错（实测丢失）：微任务延后到同步栈外落地
    const next = (e as CustomEvent<{ open: boolean }>).detail.open
    queueMicrotask(() => onOpenChange(next))
  }

  function onSelect(e: Event): void {
    // 先关面板（状态先于 navigate 落地，避免与路由同步渲染交错丢失），再执行命令
    onOpenChange(false)
    execCommand((e as CustomEvent<{ value: string }>).detail.value)
  }

  function execCommand(value: string): void {
    if (value.startsWith('/')) {
      if (value !== path.current) navigate(value)
      return
    }
    if (value === 'action:theme') {
      toggleTheme()
    } else if (value === 'action:refresh') {
      window.location.reload()
    } else if (value === 'action:logout') {
      logoutFlow()
    } else if (value === 'action:locale') {
      setLocale(currentLocale() === 'en' ? 'zh-CN' : 'en')
    } else if (value.startsWith('theme:')) {
      setTheme(value)
    }
  }

  // 全局快捷键：Ctrl/Cmd+K 切换、/ 唤起（输入类控件内不劫持）
  // open 读进 effect 体内建立依赖，open 变化时重绑（handler 内读到最新值）
  $effect(() => {
    const isOpen = open
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (session.user) onOpenChange(!isOpen)
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
  })
</script>

<!-- open 用存在性语义：oas-command 无同名 DOM 访问器——true→空串属性、false→移除属性（全壳布尔属性同理） -->
<oas-command
  id="command"
  hotkey="false"
  close-on-select="false"
  {items}
  open={open ? '' : null}
  onoas-open-change={onOpenChangeEvent}
  onoas-select={onSelect}
></oas-command>
