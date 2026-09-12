<script lang="ts">
  // 路由出口：按 currentRoute 懒加载渲染页面组件。
  // 布局壳接线口（Task 2）：非 /login 路径将在此包 AppShell 布局壳，/login 直渲页面。
  import type { Component } from 'svelte'
  import { fromStore } from 'svelte/store'
  import { currentRoute } from './index'

  // runes 原生订阅路由 store（route.current 为响应式值）
  const route = fromStore(currentRoute)

  let PageComponent = $state<Component | null>(null)
  let pageKey = $state<string>('')

  $effect(() => {
    const r = route.current
    if (!r) {
      PageComponent = null
      return
    }
    // 路由切换：先卸下旧页再懒加载新页组件（模块缓存兜底重复加载）
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

{#if PageComponent}
  {@const C = PageComponent}
  {#key pageKey}
    <C />
  {/key}
{/if}
