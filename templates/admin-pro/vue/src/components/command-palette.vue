<script setup lang="ts">
// src/components/command-palette.vue —— 命令面板：Ctrl/Cmd+K、/ 唤起；页面 + 操作 + 主题组
// 对齐 vanilla app-shell.ts buildCommandItems()/execCommand()/openCommand()/toggleCommand()
// open 状态由 AppShell 持有（头部搜索框也要唤起）。
// 沿用 react 版关键差异（vs vanilla）：close-on-select="false"，选中后由模版自己关面板——
// 组件在 oas-select 同一同步栈里自行 close() 时，open-change 派发的状态回写与 execCommand 内
// 路由导航触发的同步渲染交错会丢更新；改为 select handler 里先 emit 关面板再 execCommand，
// Esc/遮罩的组件自闭仍经 oas-open-change 微任务回写。
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useT } from '../composables/use-t'
import { logoutNavigate } from '../lib/session-actions'
import { setTheme, toggleTheme } from '../lib/theme'
import { session } from '../store/session'
import { buildCommandItems } from './nav-items'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'open-change': [open: boolean] }>()

const { locale, setLocale } = useT()
const route = useRoute()
const router = useRouter()

// locale 变化时重建 items（文案与 keywords 均含翻译）
const items = computed(() => {
  void locale.value
  return JSON.stringify(buildCommandItems())
})

function onOpenChangeEvent(e: Event): void {
  // 同步栈内直接回写会与 navigate 触发的渲染交错（实测丢失）：微任务延后到同步栈外落地
  const next = (e as CustomEvent<{ open: boolean }>).detail.open
  queueMicrotask(() => emit('open-change', next))
}

function onSelect(e: Event): void {
  // 先关面板（状态先于 navigate 落地，避免与路由同步渲染交错丢失），再执行命令
  emit('open-change', false)
  execCommand((e as CustomEvent<{ value: string }>).detail.value)
}

function execCommand(value: string): void {
  if (value.startsWith('/')) {
    // vanilla 同路径 resolve() 重渲当前页；vue-router 同路径 push 抛冗余导航错误，跳过即可
    if (value !== route.path) void router.push(value)
    return
  }
  if (value === 'action:theme') {
    toggleTheme()
  } else if (value === 'action:refresh') {
    window.location.reload()
  } else if (value === 'action:logout') {
    logoutNavigate(router)
  } else if (value === 'action:locale') {
    setLocale(locale.value === 'en' ? 'zh-CN' : 'en')
  } else if (value.startsWith('theme:')) {
    setTheme(value)
  }
}

// 全局快捷键：Ctrl/Cmd+K 切换、/ 唤起（输入类控件内不劫持）
function onGlobalKeydown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (session.user) emit('open-change', !props.open)
    return
  }
  if (e.key !== '/' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable="true"], oas-input, oas-select'))
    return
  e.preventDefault()
  if (session.user) emit('open-change', true)
}
onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <!-- open 用存在性语义：oas-command 无同名 DOM 访问器，Vue 布尔绑定会写成 open="false"
       字符串，组件按「属性存在即开」判定——true→空串属性、false→移除属性（全壳布尔属性同理） -->
  <oas-command
    id="command"
    hotkey="false"
    close-on-select="false"
    :items="items"
    :open="open ? '' : null"
    @oas-open-change="onOpenChangeEvent"
    @oas-select="onSelect"
  />
</template>
