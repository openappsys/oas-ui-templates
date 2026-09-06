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
