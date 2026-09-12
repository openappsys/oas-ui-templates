<script lang="ts">
  // 路由出口：按 currentRoute 懒加载渲染页面组件。
  // 非 /login 路径包 AppShell 布局壳，/login 直渲页面（无壳模式由路由分支天然接管）。
  // 壳的存在性只随「login ⇄ 非login」分派切换：页面懒加载的空档（PageComponent 短暂为 null）
  // 不得卸壳——否则 AppShell（含页签栏状态）随每次导航重建，多页签无法跨路由累积
  // （对齐 react 版 AppShell 常驻布局路由语义，e2e/tabs.spec 验收点）
  import type { Component } from 'svelte'
  import { fromStore } from 'svelte/store'
  import AppShell from '../components/app-shell.svelte'
  import { currentRoute } from './index'

  // runes 原生订阅路由 store（route.current 为响应式值）
  const route = fromStore(currentRoute)

  let PageComponent = $state<Component | null>(null)
  let pageKey = $state<string>('')
  const isLoginPath = $derived(route.current?.path === '/login')

  $effect(() => {
    const r = route.current
    if (!r) {
      PageComponent = null
      return
    }
    // 路由切换：卸下旧页再懒加载新页组件（模块缓存兜底重复加载）；壳不受影响
    PageComponent = null
    pageKey = r.path
    let cancelled = false
    r.Component().then((m) => {
      if (!cancelled) PageComponent = m.default
    })
    return () => {
      cancelled = true
    }
  })
</script>

{#snippet page(C: Component)}
  {#key pageKey}
    <C />
  {/key}
{/snippet}

{#if isLoginPath}
  {#if PageComponent}
    {@render page(PageComponent)}
  {/if}
{:else}
  <AppShell>
    {#if PageComponent}
      {@render page(PageComponent)}
    {/if}
  </AppShell>
{/if}
