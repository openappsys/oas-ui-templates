<script setup lang="ts">
// src/components/nav-menu.vue —— 导航菜单：sidebar / menubar / navigation 三形态 × 位置分派
// 对齐 vanilla app-shell.ts menuHTML()/bindNav()/applyNavActive()：
//   高亮三机制——sidebar 用 active 属性；menubar 用 value 属性（radio ✓ 高亮）；
//   navigation 用 items 内 active 字段（value 必须留空，否则 findItem 落空面板空白）
// 形态/位置切换由调用方用 key 重挂载本组件（事件随模板直绑，天然绑到新元素）
// 差异（vs react）：prop style 改名 menuStyle——Vue 模板中 style 是保留特性绑定，不能作 prop 名
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useT } from '../composables/use-t'
import {
  readSidebarCollapsed,
  writeSidebarCollapsed,
  type MenuStyle,
} from '../layout-config'
import { groupMenuItems, sidebarItems } from './nav-items'

const props = defineProps<{
  menuStyle: MenuStyle
  /** 竖排（left/right 槽位）或横排（top / top-head） */
  vertical: boolean
  activePath: string
  /** 浮层形态（☰ 弹出面板）：id 用 nav-popover，menubar 加 trigger="click" */
  popover?: boolean
}>()
const emit = defineEmits<{ navigate: [] }>()

const router = useRouter()
const { locale } = useT()
const collapsed = ref(readSidebarCollapsed())
const id = props.popover ? 'nav-popover' : 'nav'

// items 随 activePath/locale 重建（locale 为共享响应式源，读取即建立依赖）
const sidebarJson = computed(() => {
  void locale.value
  return JSON.stringify(sidebarItems())
})
const groupJsonNoHref = computed(() => {
  void locale.value
  return JSON.stringify(groupMenuItems(props.activePath, false))
})
const groupJsonHref = computed(() => {
  void locale.value
  return JSON.stringify(groupMenuItems(props.activePath, true))
})

function onSelect(e: Event): void {
  const { value } = (e as CustomEvent<{ value: string }>).detail
  if (!value) return
  // vanilla 同路径会 resolve() 重渲当前页；vue-router 同路径 push 抛冗余导航错误，跳过即可
  if (value !== props.activePath) void router.push(value)
  emit('navigate')
}

// 折叠持久化：仅 sidebar 形态有折叠（collapsed）
function onCollapse(e: Event): void {
  if (props.menuStyle !== 'sidebar') return
  const detail = (e as CustomEvent<{ collapsed: boolean }>).detail
  if (typeof detail?.collapsed === 'boolean') {
    writeSidebarCollapsed(detail.collapsed)
    collapsed.value = detail.collapsed
  }
}

// navigation 在浮层容器里首帧测量会坍缩成 0×0（oas-navigation-menu 浮层测量缺陷）：
// 挂载稳定后重设 items 触发重新测量兜底（vanilla toggleMenuPopover 同款 rAF 重设）
const navEl = ref<HTMLElement | null>(null)
let rafId = 0
onMounted(() => {
  if (!props.popover || props.menuStyle !== 'navigation') return
  rafId = requestAnimationFrame(() => {
    navEl.value?.setAttribute('items', JSON.stringify(groupMenuItems(props.activePath, true)))
  })
})
// 组件在 rAF 前卸载时取消（浮层快速开关场景）
onUnmounted(() => cancelAnimationFrame(rafId))
</script>

<template>
  <oas-menubar
    v-if="menuStyle === 'menubar'"
    :id="id"
    ref="navEl"
    :orientation="vertical ? 'vertical' : 'horizontal'"
    :trigger="popover ? 'click' : undefined"
    :items="groupJsonNoHref"
    :value="activePath"
    @oas-select="onSelect"
  />
  <oas-navigation-menu
    v-else-if="menuStyle === 'navigation'"
    :id="id"
    ref="navEl"
    :orientation="vertical ? 'vertical' : 'horizontal'"
    :items="groupJsonHref"
    @oas-select="onSelect"
  />
  <oas-sider v-else :id="popover ? undefined : 'nav-sider'">
    <oas-sidebar
      :id="id"
      ref="navEl"
      :items="sidebarJson"
      :active="activePath"
      :collapsed="collapsed ? '' : null"
      @oas-select="onSelect"
      @oas-collapse="onCollapse"
    />
  </oas-sider>
</template>
