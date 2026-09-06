<script setup lang="ts">
// src/components/header-bar.vue —— 顶栏：☰/logo/（top-head 菜单槽）/搜索/全屏/主题点/语言/通知 badge/用户菜单
// Vue 化差异：oas-* 自定义事件（oas-select）模板直绑（Vue 原生支持 kebab 事件，无需桥接）；
// 文案重渲靠 t() 包装函数读 locale.value 建立响应式依赖
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useT } from '../composables/use-t'
import { logoutNavigate } from '../lib/session-actions'
import { toggleTheme } from '../lib/theme'
import { useSessionStore } from '../stores/session'
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

// 会话用户：Pinia store 响应式状态（storeToRefs 解构保持响应性），登录/登出自动重渲
const { user } = storeToRefs(useSessionStore())

// 全屏态同步（Esc 退出等浏览器侧变更也要回写 aria-pressed / is-fullscreen）
const isFullscreen = ref(false)
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
    <!-- 增强（偏离 vanilla）：vanilla 的 logo 是纯展示 span；此处为链接，点击回站点首页（门户 /）。
         用原生 <a href="/"> 而非路由内跳转——目标是「离开模版回到门户」，不是模版内路由 -->
    <a
      class="oas-logo"
      href="/"
      style="cursor: pointer; text-decoration: none; color: inherit"
    >
      <span class="oas-logo-badge">OAS</span>
      <span class="oas-logo-word">OAS Admin Pro</span>
    </a>
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

<style scoped>
/* 顶栏样式（自 app.css 迁入）：scoped 仅追加 data-v 属性、不改类名 */
.app-header {
  display: flex;
  align-items: center;
  gap: var(--oas-space-3);
  padding: 0 var(--oas-space-4);
  padding-left: calc(var(--oas-space-4) + var(--oas-space-3) + var(--oas-space-2));
  height: 56px;
  border-bottom: 1px solid var(--oas-color-border);
}
.spacer {
  flex: 1;
}

.global-search {
  display: inline-flex;
  align-items: center;
  gap: var(--oas-space-2);
  cursor: pointer;
}
.global-search oas-input {
  width: 100%;
  max-width: 400px;
}
.global-search:hover oas-input::part(input) {
  border-color: var(--oas-color-primary);
}
.kbd-hint {
  font-family: var(--app-mono);
  font-size: 10px;
  line-height: 1;
  color: var(--oas-color-text-secondary);
  border: 1px solid var(--oas-color-border);
  border-radius: 4px;
  padding: 3px 6px;
  user-select: none;
}

.theme-dot {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}
.theme-dot::before {
  content: "";
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--oas-color-border);
  background: transparent;
  box-shadow: inset 4px 2px 0 0 var(--oas-color-text-primary);
}
/* 暗色主题下的日/月切换点：conic-gradient 画月相（html 祖先选择器在 scoped 下仅主题部分生效） */
html[data-theme="dark"] .theme-dot::before {
  background:
    radial-gradient(circle, var(--oas-color-text-primary) 4px, transparent 5px),
    conic-gradient(
      from 0deg,
      var(--oas-color-text-primary) 0deg 12deg,
      transparent 12deg 33deg,
      var(--oas-color-text-primary) 33deg 45deg,
      transparent 45deg 66deg,
      var(--oas-color-text-primary) 66deg 78deg,
      transparent 78deg 99deg,
      var(--oas-color-text-primary) 99deg 111deg,
      transparent 111deg 132deg,
      var(--oas-color-text-primary) 132deg 144deg,
      transparent 144deg 165deg,
      var(--oas-color-text-primary) 165deg 177deg,
      transparent 177deg 198deg,
      var(--oas-color-text-primary) 198deg 210deg,
      transparent 210deg 231deg,
      var(--oas-color-text-primary) 231deg 243deg,
      transparent 243deg 264deg,
      var(--oas-color-text-primary) 264deg 276deg,
      transparent 276deg 297deg,
      var(--oas-color-text-primary) 297deg 309deg,
      transparent 309deg 330deg,
      var(--oas-color-text-primary) 330deg 342deg,
      transparent 342deg 360deg
    );
  box-shadow: none;
  border: none;
}

.icon-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--oas-color-text-primary);
}
.icon-btn:hover {
  background: var(--oas-color-bg-hover);
}
.icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--oas-focus-ring);
}

.fullscreen-btn .fs-compress {
  display: none;
}
.fullscreen-btn.is-fullscreen .fs-compress {
  display: inline-flex;
}
.fullscreen-btn.is-fullscreen .fs-expand {
  display: none;
}

/* 通知 badge 数字变化时的弹跳动画：keyframes 会被 scoped 重命名，同块内引用同步改写，行为一致 */
#notif-badge.is-pop::part(badge) {
  animation: notifBadgePop 300ms var(--oas-ease-out);
}
@keyframes notifBadgePop {
  0% {
    scale: 0.6;
  }
  60% {
    scale: 1.15;
  }
  100% {
    scale: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  #notif-badge.is-pop::part(badge) {
    animation: none;
  }
}

/* ☰ 折叠钮：桌面隐藏，移动端显示 */
.nav-toggle {
  display: none;
}

@media (max-width: 768px) {
  .app-header {
    padding-left: var(--oas-space-4);
  }
  .nav-toggle {
    display: inline-flex;
  }

  @media (pointer: coarse) {
    .nav-toggle::part(button) {
      min-height: 44px;
    }
  }
  .global-search {
    display: none;
  }
  .fullscreen-btn {
    display: none;
  }
}
</style>
