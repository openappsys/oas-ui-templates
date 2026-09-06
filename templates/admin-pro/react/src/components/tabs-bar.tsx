// src/components/tabs-bar.tsx —— 页签栏：oas-tabs + 右键批量关闭 + 自定义关闭钮
//   oas-change 切路由；oas-close 微任务合批（组件「关闭其他/全部」会连发多个 oas-close）；
//   [data-ptab-close] 关闭钮捕获阶段拦截（click + Enter/Space）；首页页签不可关
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import './tabs-bar.css'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { matchRoute } from '../router/routes'
import { HOME_PATH } from '../router/tabs'
import { useTabs } from '../router/use-tabs'

/** 从事件 composedPath 解析被点的 [data-ptab-close] 所在页签 key（阴影 DOM 需 composedPath） */
function closeKeyOf(e: React.SyntheticEvent): string | null {
  const path = e.nativeEvent.composedPath()
  if (!path.some((n) => n instanceof Element && n.hasAttribute('data-ptab-close'))) return null
  const tabNode = path.find(
    (n): n is Element => n instanceof Element && n.getAttribute('role') === 'tab',
  )
  return tabNode?.getAttribute('data-value') ?? null
}

export function TabsBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useT()
  const { view, closeTab, closeKeys, navigateTo } = useTabs(location.pathname)
  const tabsRef = useRef<HTMLElement>(null)
  // oas-close 合批：右键「关闭其他/全部」组件逐个 key 连发，同一微任务内合并成一次 closeKeys
  const closeBatchRef = useRef<Set<string>>(new Set())
  const batchScheduledRef = useRef(false)

  // 关闭页签后的落点导航（useTabs 归约出 navigateTo，此处执行）
  useEffect(() => {
    if (navigateTo) navigate(navigateTo)
  }, [navigateTo, navigate])

  useOasEvent<{ value: string }>(tabsRef, 'oas-change', (detail) => {
    if (detail.value && detail.value !== location.pathname) navigate(detail.value)
  })

  useOasEvent<{ key: string }>(tabsRef, 'oas-close', (detail) => {
    if (!detail.key) return
    closeBatchRef.current.add(detail.key)
    if (batchScheduledRef.current) return
    batchScheduledRef.current = true
    queueMicrotask(() => {
      batchScheduledRef.current = false
      const keys = [...closeBatchRef.current]
      closeBatchRef.current.clear()
      closeKeys(keys)
    })
  })

  useOasEvent(tabsRef, 'oas-add', () => navigate(HOME_PATH))

  const closeFromEvent = (e: React.SyntheticEvent) => {
    const key = closeKeyOf(e)
    if (!key) return
    e.preventDefault()
    e.stopPropagation()
    closeTab(key)
  }

  return (
    <div className="tabs-bar">
      <oas-tabs
        id="page-tabs"
        ref={tabsRef as React.Ref<HTMLElement>}
        data-testid="page-tabs"
        type="card"
        hide-content
        context-menu
        active={view.active ?? ''}
        onClickCapture={closeFromEvent}
        onKeyDownCapture={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          closeFromEvent(e)
        }}
      >
        {view.keys.map((key) => {
          const route = matchRoute(key)
          const label = route ? t(route.meta.titleKey) : key
          return (
            <oas-tab-panel key={key} value={key}>
              <span slot="label" className="ptab">
                {label}
                {key !== HOME_PATH && (
                  <span
                    className="ptab-close"
                    role="button"
                    tabIndex={-1}
                    title={t('tabs.closeTab')}
                    aria-label={t('tabs.closeTab')}
                    data-ptab-close=""
                  >
                    <oas-icon name="close" size="12" />
                  </span>
                )}
              </span>
            </oas-tab-panel>
          )
        })}
      </oas-tabs>
    </div>
  )
}
