<script setup lang="ts">
// src/components/header-bar.vue —— 顶栏：☰/logo/（top-head 菜单槽）/搜索/全屏/主题点/语言/通知 badge/用户菜单
// 结构、id、类名逐字对齐 vanilla app-shell.ts 的 <header class="app-header"> 模板（经 react 版校准）
// Vue 化差异：oas-* 自定义事件（oas-select）模板直绑（Vue 原生支持 kebab 事件，无需桥接）；
// 文案重渲靠 t() 包装函数读 locale.value 建立响应式依赖
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useT } from '../composables/use-t'
import { logoutNavigate } from '../lib/session-actions'
import { toggleTheme } from '../lib/theme'
import { session, type User } from '../store/session'
import { LANG_ITEMS, userMenuItems } from './nav-items'

const props = defineProps<{ notifCount: number }>()
const emit = defineEmits<{
  'nav-toggle': []
  'open-command': []
  'toggle-notif': []
}>()

const { t: tt, locale, setLocale } = useT()
const router = useRouter()

/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时整壳重渲（各 items/文案随之刷新） */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

// 会话用户：session 是裸模块（带 subscribe），本地 ref + 订阅驱动重渲
const user = ref<User | null>(session.user)
let unsubSession: (() => void) | undefined
onMounted(() => {
  unsubSession = session.subscribe(() => {
    user.value = session.user
  })
})
onUnmounted(() => unsubSession?.())

// 全屏态同步（Esc 退出等浏览器侧变更也要回写 aria-pressed / is-fullscreen）
const isFullscreen = ref(false)
// 全屏可用性挂载时判定一次即可（vanilla: fullscreenEnabled 不支持则隐藏按钮）
const fsSupported = document.fullscreenEnabled
function onFullscreenChange(): void {
  isFullscreen.value = document.fullscreenElement != null
}
onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
onUnmounted(() => document.removeEventListener('fullscreenchange', onFullscreenChange))

function safeFullscreen(p: Promise<void> | undefined): void {
  if (p && typeof p.catch === 'function') p.catch(() => {})
}
function onFullscreenClick(): void {
  if (document.fullscreenElement) safeFullscreen(document.exitFullscreen())
  else safeFullscreen(document.documentElement.requestFullscreen())
}

// 语言下拉：选择即切换 locale（locale 响应式令全壳重渲）
function onLangSelect(e: Event): void {
  const { value } = (e as CustomEvent<{ value: string }>).detail
  if (value === 'zh-CN' || value === 'en') setLocale(value)
}

// 用户下拉：个人中心 / 登出
function onUserSelect(e: Event): void {
  const { value } = (e as CustomEvent<{ value: string }>).detail
  if (value === 'logout') logoutNavigate(router)
  else if (value === '/profile') void router.push(value)
}

// 用户菜单 items 随 locale 重建
const userItems = computed(() => {
  void locale.value
  return userMenuItems()
})

// 未读数变化时 badge 弹跳（vanilla syncBadge 的 is-pop 重触发动画）
const badgeEl = ref<HTMLElement | null>(null)
let lastCount = -1
function syncBadgePop(): void {
  const el = badgeEl.value
  if (!el || props.notifCount === lastCount) return
  lastCount = props.notifCount
  el.classList.remove('is-pop')
  void el.offsetWidth
  el.classList.add('is-pop')
}
onMounted(syncBadgePop)
watch(() => props.notifCount, syncBadgePop)

// 搜索框：readonly 拦截指针默认行为；单击/Enter 唤起命令面板
function onSearchPointerDown(e: PointerEvent): void {
  e.preventDefault()
}
function onSearchKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter') return
  e.preventDefault()
  emit('open-command')
}
</script>

<template>
  <header class="app-header" slot="header">
    <oas-button
      id="nav-toggle"
      class="nav-toggle"
      type="text"
      icon="menu"
      :aria-label="t('header.openMenu')"
      @click="emit('nav-toggle')"
    />
    <span class="oas-logo">
      <span class="oas-logo-badge">OAS</span>
      <span class="oas-logo-word">OAS Admin Pro</span>
    </span>
    <!-- top-head 位置时塞在 logo 与搜索框之间的菜单节点 -->
    <slot name="header-menu" />
    <span class="spacer" />
    <div class="global-search">
      <oas-input
        id="global-search"
        :placeholder="t('header.search')"
        prefix-icon="search"
        readonly
        @pointerdown="onSearchPointerDown"
        @click="emit('open-command')"
        @keydown="onSearchKeydown"
      />
      <span class="kbd-hint">/</span>
    </div>
    <span class="spacer" />
    <button
      id="fullscreen-toggle"
      class="icon-btn fullscreen-btn"
      :class="{ 'is-fullscreen': isFullscreen }"
      type="button"
      :title="t('header.fullscreen')"
      :aria-label="t('header.fullscreen')"
      :aria-pressed="isFullscreen"
      :hidden="!fsSupported"
      @click="onFullscreenClick"
    >
      <oas-icon size="18" class="fs-expand">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        >
          <path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5" />
          <path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5" />
          <path d="M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11" />
          <path d="M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11" />
        </svg>
      </oas-icon>
      <oas-icon size="18" class="fs-compress">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        >
          <path d="M2 5h3V2" />
          <path d="M14 5h-3V2" />
          <path d="M14 11h-3v3" />
          <path d="M2 11h3v3" />
        </svg>
      </oas-icon>
    </button>
    <button
      id="theme-toggle"
      class="theme-dot"
      type="button"
      :title="t('header.theme')"
      :aria-label="t('header.theme')"
      @click="toggleTheme"
    />
    <oas-dropdown
      id="lang-menu"
      placement="bottom"
      arrow-point-at-center
      trigger="hover click"
      :value="locale"
      :items="LANG_ITEMS"
      @oas-select="onLangSelect"
    >
      <button
        id="lang-toggle"
        class="icon-btn"
        type="button"
        :title="t('cmd.locale')"
        :aria-label="t('cmd.locale')"
        aria-haspopup="menu"
      >
        <oas-icon size="18">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="8" cy="8" r="6" />
            <path d="M2 8h12" />
            <path d="M8 2c2 1.7 3 3.8 3 6s-1 4.3-3 6c-2-1.7-3-3.8-3-6s1-4.3 3-6z" />
          </svg>
        </oas-icon>
      </button>
    </oas-dropdown>
    <oas-badge
      id="notif-badge"
      ref="badgeEl"
      :value="String(notifCount)"
      size="small"
      offset="-2,2"
    >
      <button
        id="notif-toggle"
        class="icon-btn"
        type="button"
        :title="t('header.notification')"
        :aria-label="t('header.notificationCount', { count: notifCount })"
        @click="emit('toggle-notif')"
      >
        <oas-icon size="18">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M8 2.2a3.6 3.6 0 0 1 3.6 3.6c0 2.2.5 3.4 1.5 4.4H2.9c1-1 1.5-2.2 1.5-4.4A3.6 3.6 0 0 1 8 2.2z"
            />
            <path d="M6.7 12.4a1.4 1.4 0 0 0 2.6 0" />
          </svg>
        </oas-icon>
      </button>
    </oas-badge>
    <oas-dropdown
      id="user-menu"
      placement="bottom"
      arrow-point-at-center
      trigger="hover click"
      :items="userItems"
      @oas-select="onUserSelect"
    >
      <oas-avatar
        id="user-avatar"
        size="28"
        :text="(user?.name ?? '').charAt(0).toUpperCase()"
        :aria-label="t('header.userMenu')"
        aria-haspopup="menu"
      />
    </oas-dropdown>
  </header>
</template>
