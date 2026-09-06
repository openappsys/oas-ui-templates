<script setup lang="ts">
// src/components/tabs-bar.vue —— 页签栏：oas-tabs + 右键批量关闭 + 自定义关闭钮
//   oas-change 切路由；oas-close 微任务合批（组件「关闭其他/全部」会连发多个 oas-close）；
//   [data-ptab-close] 关闭钮捕获阶段拦截（click + Enter/Space）；首页页签不可关
// Vue 化差异：@click.capture/@keydown.capture 直绑 oas-tabs 元素（Vue 不用根委托，无冒泡陷阱）
import { toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useT } from '../composables/use-t'
import { useTabs } from '../composables/use-tabs'
import { matchRoute } from '../router/routes'
import { HOME_PATH } from '../router/tabs'

const route = useRoute()
const router = useRouter()
const { t: tt, locale } = useT()
const { state, closeTab, closeKeys } = useTabs(toRef(route, 'path'))

/** 页签文案：读 locale.value 建立响应式依赖，切语言时重渲 */
function labelOf(key: string): string {
  void locale.value
  const r = matchRoute(key)
  return r ? tt(r.meta.titleKey) : key
}

// 关闭页签后的落点导航（useTabs 归约出 navigateTo，此处执行）
watch(
  () => state.navigateTo,
  (to) => {
    if (to) void router.push(to)
  },
)

function onChange(e: Event): void {
  const { value } = (e as CustomEvent<{ value: string }>).detail
  if (value && value !== route.path) void router.push(value)
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
    closeKeys(keys)
  })
}

function onAdd(): void {
  void router.push(HOME_PATH)
}

/** 从事件 composedPath 解析被点的 [data-ptab-close] 所在页签 key（阴影 DOM 需 composedPath） */
function closeKeyOf(e: Event): string | null {
  const path = e.composedPath()
  if (!path.some((n) => n instanceof Element && n.hasAttribute('data-ptab-close'))) return null
  const tabNode = path.find(
    (n): n is Element => n instanceof Element && n.getAttribute('role') === 'tab',
  )
  return tabNode?.getAttribute('data-value') ?? null
}

function closeFromEvent(e: Event): void {
  const key = closeKeyOf(e)
  if (!key) return
  e.preventDefault()
  e.stopPropagation()
  closeTab(key)
}

function onKeydownCapture(e: KeyboardEvent): void {
  if (e.key !== 'Enter' && e.key !== ' ') return
  closeFromEvent(e)
}
</script>

<template>
  <div class="tabs-bar">
    <oas-tabs
      id="page-tabs"
      data-testid="page-tabs"
      type="card"
      hide-content
      context-menu
      :active="state.view.active ?? ''"
      @oas-change="onChange"
      @oas-close="onClose"
      @oas-add="onAdd"
      @click.capture="closeFromEvent"
      @keydown.capture="onKeydownCapture"
    >
      <oas-tab-panel v-for="key in state.view.keys" :key="key" :value="key">
        <span slot="label" class="ptab">
          {{ labelOf(key) }}
          <span
            v-if="key !== HOME_PATH"
            class="ptab-close"
            role="button"
            tabindex="-1"
            :title="tt('tabs.closeTab')"
            :aria-label="tt('tabs.closeTab')"
            data-ptab-close=""
          >
            <oas-icon name="close" size="12" />
          </span>
        </span>
      </oas-tab-panel>
    </oas-tabs>
  </div>
</template>

<style scoped>
/* 页签栏样式（自 app.css 迁入）：.ptab/.ptab-close 为 e2e 依赖类名，scoped 仅追加 data-v 属性 */
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
/* 设置页可整体关闭页签栏（html 祖先选择器在 scoped 下仅主题部分生效） */
html[data-tabs-bar="off"] .tabs-bar {
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
