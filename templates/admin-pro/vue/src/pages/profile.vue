<script setup lang="ts">
// src/pages/profile.vue —— 个人中心：头像/账户信息 + 主题预览切换 + 登出
//    selectedTheme ref + class 绑定派生；applyTheme 写 <html data-theme> 并派发
//    delete dataset.theme，与壳层 setTheme 的解析式写法语义不同，不强行复用）
//    本模版页签切换会重挂载页面，必须 onUnmounted 解绑避免监听器累积
//    本模版复用壳层同款 logoutNavigate(router)（lib/session-actions.ts，含同路径
//    冗余导航的 /login 兜底，见该文件注释）
//    本模版以 :style 条件绑定保留同一行为以对齐 DOM
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { session } from '../store/session'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import { logoutNavigate } from '../lib/session-actions'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const router = useRouter()
const user = session.user!

const roleLabel = computed(() =>
  user.role === 'admin' ? t('users.role.admin') : t('profile.roleViewer'),
)
const avatarText = user.name.charAt(0).toUpperCase()

const loginAtLabel = computed(() => {
  const n = session.loginAt
  if (!n) return '-'
  const tag = locale.value === 'en' ? 'en-US' : 'zh-CN'
  return new Intl.DateTimeFormat(tag, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(n))
})

function currentTheme(): string {
  if (document.documentElement.dataset.theme === 'dark') return 'dark'
  if (document.documentElement.dataset.theme === 'light') return 'light'
  return 'system'
}
const selectedTheme = ref(currentTheme())

function applyTheme(next: string): void {
  if (next === 'system') {
    delete document.documentElement.dataset.theme
    appMessage.info(tt('profile.systemThemeMsg'))
  } else {
    document.documentElement.dataset.theme = next
  }
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
  selectedTheme.value = currentTheme()
}

// 外部（头部/命令面板）切换主题时同步选中态；卸载必须解绑（见头注释第 3 条）
function onThemeChange(): void {
  selectedTheme.value = currentTheme()
}
onMounted(() => document.addEventListener('themechange', onThemeChange))
onUnmounted(() => document.removeEventListener('themechange', onThemeChange))

function onLogout(): void {
  logoutNavigate(router)
}

const THEME_PREVIEWS = [
  { theme: 'light', cls: 'is-light', mini: 'light-mini', ariaKey: 'profile.theme.light', labelKey: 'cmd.light' },
  { theme: 'dark', cls: 'is-dark', mini: 'dark-mini', ariaKey: 'profile.theme.dark', labelKey: 'cmd.dark' },
  { theme: 'system', cls: 'is-system', mini: 'system-mini', ariaKey: 'profile.theme.system', labelKey: 'cmd.system' },
] as const
</script>

<template>
  <div class="page">
    <h1 class="page-title">{{ t('nav.profile') }}</h1>
    <div class="profile-layout">
      <oas-card class="profile-left">
        <div class="profile-avatar-wrap">
          <oas-avatar
            id="profile-avatar"
            size="64"
            :style="user.role === 'admin' ? { '--oas-color-primary': 'var(--oas-color-primary)' } : null"
          >
            <span slot="fallback" id="profile-avatar-text" class="profile-avatar-fallback">
              {{ avatarText }}
            </span>
          </oas-avatar>
          <div id="profile-name" class="profile-name">{{ user.name }}</div>
          <oas-tag id="profile-role-tag" type="primary">{{ roleLabel }}</oas-tag>
        </div>
        <oas-divider />
        <div class="profile-logout-wrap">
          <oas-button id="profile-logout" type="danger" variant="text" @click="onLogout">
            {{ t('header.logout') }}
          </oas-button>
        </div>
      </oas-card>
      <oas-card class="profile-right" :title="t('profile.accountInfo')">
        <oas-descriptions column="2">
          <oas-descriptions-item :label="t('profile.username')">
            <span id="profile-name2">{{ user.name }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('profile.role')">
            <span id="profile-role2">{{ roleLabel }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('profile.loginAt')">
            <span id="profile-login-at">{{ loginAtLabel }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('profile.dataVersion')">
            <span>{{ t('profile.demoData') }}</span>
          </oas-descriptions-item>
        </oas-descriptions>
      </oas-card>
    </div>
    <oas-card class="profile-theme" :title="t('profile.appearance')">
      <div class="theme-previews">
        <button
          v-for="p in THEME_PREVIEWS"
          :key="p.theme"
          class="theme-preview"
          :class="[p.cls, { 'is-selected': selectedTheme === p.theme }]"
          :data-theme="p.theme"
          :aria-label="t(p.ariaKey)"
          @click="applyTheme(p.theme)"
        >
          <span class="preview-mini" :class="p.mini" />
          <span class="preview-label">{{ t(p.labelKey) }}</span>
        </button>
      </div>
    </oas-card>
  </div>
</template>
