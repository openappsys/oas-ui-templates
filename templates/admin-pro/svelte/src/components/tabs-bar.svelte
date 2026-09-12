<script lang="ts">
  // src/components/tabs-bar.svelte —— 页签栏：oas-tabs + 右键批量关闭 + 自定义关闭钮
  //   oas-change 切路由；oas-close 微任务合批（组件「关闭其他/全部」会连发多个 oas-close）；
  //   [data-ptab-close] 关闭钮捕获阶段拦截（click + Enter/Space）；首页页签不可关
  import { untrack } from 'svelte'
  import { fromStore } from 'svelte/store'
  import { useT } from '../lib/use-t.svelte'
  import { currentPath, navigate } from '../router'
  import { matchRoute } from '../router/routes'
  import {
    HOME_PATH,
    closeTab as closeOneTab,
    closeKeys as closeTabsByKeys,
    visit,
    type TabsView,
  } from '../router/tabs'

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  const path = fromStore(currentPath)
  let view = $state<TabsView>({ keys: [], active: null })
  let navigateTo = $state<string | null>(null)

  // 路由变化时归约 visit（untrack 读旧 view，避免写回触发自身无限重跑）
  $effect(() => {
    const p = path.current
    untrack(() => {
      view = visit(view, p)
      navigateTo = null
    })
  })

  // 关闭页签后的落点导航（归约出 navigateTo，此处执行）
  $effect(() => {
    const to = navigateTo
    if (to) navigate(to)
  })

  /** 页签文案：经 tt 读 locale 建立响应式依赖 */
  function labelOf(key: string): string {
    const r = matchRoute(key)
    return r ? tt(r.meta.titleKey) : key
  }

  function onChange(e: Event): void {
    const { value } = (e as CustomEvent<{ value: string }>).detail
    if (value && value !== path.current) navigate(value)
  }

  // oas-close 合批：右键「关闭其他/全部」组件逐个 key 连发，同一微任务内合并成一次 closeKeys
  const closeBatch = new Set<string>()
  let batchScheduled = false
  function onClose(e: Event): void {
    const { key } = (e as CustomEvent<{ key: string }>).detail
    if (!key) return
    closeBatch.add(key)
    if (batchScheduled) return
    batchScheduled = true
    queueMicrotask(() => {
      batchScheduled = false
      const keys = [...closeBatch]
      closeBatch.clear()
      const r = closeTabsByKeys(view, keys)
      view = r.view
      navigateTo = r.navigateTo
    })
  }

  function onAdd(): void {
    navigate(HOME_PATH)
  }

  /** 从事件 composedPath 解析被点的 [data-ptab-close] 所在页签 key（阴影 DOM 需 composedPath） */
  function closeKeyOf(e: Event): string | null {
    const composed = e.composedPath()
    if (!composed.some((n) => n instanceof Element && n.hasAttribute('data-ptab-close')))
      return null
    const tabNode = composed.find(
      (n): n is Element => n instanceof Element && n.getAttribute('role') === 'tab',
    )
    return tabNode?.getAttribute('data-value') ?? null
  }

  function closeFromEvent(e: Event): void {
    const key = closeKeyOf(e)
    if (!key) return
    e.preventDefault()
    e.stopPropagation()
    const r = closeOneTab(view, key)
    view = r.view
    navigateTo = r.navigateTo
  }

  function onKeydownCapture(e: KeyboardEvent): void {
    if (e.key !== 'Enter' && e.key !== ' ') return
    closeFromEvent(e)
  }
</script>

<div class="tabs-bar">
  <!-- oas-tabs 只观察 childList，label 变化不重读——切语言时按 locale 重挂载刷新页签头 -->
  {#key $locale}
    <oas-tabs
      id="page-tabs"
      data-testid="page-tabs"
      type="card"
      hide-content
      context-menu
      active={view.active ?? ''}
      onoas-change={onChange}
      onoas-close={onClose}
      onoas-add={onAdd}
      onclickcapture={closeFromEvent}
      onkeydowncapture={onKeydownCapture}
    >
      {#each view.keys as key (key)}
        <oas-tab-panel value={key}>
          <span slot="label" class="ptab">
            {labelOf(key)}
            {#if key !== HOME_PATH}
              <span
                class="ptab-close"
                role="button"
                tabindex="-1"
                title={tt('tabs.closeTab')}
                aria-label={tt('tabs.closeTab')}
                data-ptab-close=""
              >
                <oas-icon name="close" size="12"></oas-icon>
              </span>
            {/if}
          </span>
        </oas-tab-panel>
      {/each}
    </oas-tabs>
  {/key}
</div>

<style>
  .tabs-bar {
    flex-shrink: 0;
    display: flex;
    align-items: stretch;
    gap: var(--oas-space-2);
    min-width: 0;
    padding: var(--oas-space-2) var(--oas-space-3) 0;
    background: var(--oas-color-bg);
    border-bottom: 1px solid var(--oas-color-border);
  }
  /* 设置页可整体关闭页签栏 */
  :global(html[data-tabs-bar="off"]) .tabs-bar {
    display: none;
  }
  .tabs-bar oas-tabs {
    flex: 1;
    min-width: 0;
  }
  .tabs-bar oas-tabs::part(nav) {
    border-bottom: none;
  }
  .ptab {
    display: inline-flex;
    align-items: center;
    gap: var(--oas-space-1_5);
    min-width: 0;
  }
  .ptab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    margin-inline-end: calc(-1 * var(--oas-space-1));
    border-radius: 50%;
    cursor: pointer;
    color: var(--oas-color-text-secondary);
  }
  .ptab-close:hover {
    color: var(--oas-color-text-primary);
    background: var(--oas-color-bg-hover);
  }
  .ptab-close:focus-visible {
    outline: none;
    box-shadow: var(--oas-focus-ring);
  }
</style>
