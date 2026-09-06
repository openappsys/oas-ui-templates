<script setup lang="ts">
// src/pages/login.vue —— 登录页：双版式（split/glass）+ oas-form 本地直登
// （登录页样式在本文件底部 <style scoped>，.oas-logo 品牌类为 header 共用留全局）
//    route.query 读写（hash 模式下查询串在 hash 内，vue-router 正常解析 route.query），
//    router.replace 触发重渲染切换版式，不整页刷新
// 2. 事件绑定：oas-submit/oas-enter 模板直绑（Vue 3 对 custom element kebab 事件原生支持，
//    见 无需 react 版 useOasEvent 桥接）；切换版式时声明式绑定随 vnode
//    自动重挂，无 react 版「元素重挂载而 ref 不变、useEffect 不重绑」的丢监听问题
//    其 shadowRoot 内 <form> requestSubmit()（playground 实测模式）
//    后整页重渲染，rules/options 等 JSON attribute 随 computed 重算
//    跳转会因已登录路由表无 /login 匹配而白屏）；本模版对齐 react 用 router.replace——
//    登录页不留入历史栈，消除登录后回退又回登录页的边角 UX
// 6. formBlock 复用：react 版共享 JSX 片段；Vue SFC 模板无法跨分支共享片段，
//    split/glass 两分支各写一份（结构/类名逐行一致，改动需两处同步）
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useT } from '../composables/use-t'
import { useSessionStore } from '../stores/session'
import { appRoutes } from '../router/routes'

type LoginStyle = 'split' | 'glass'

interface LoginSubmitDetail {
  values: { name: string; role?: string }
}

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const route = useRoute()
const router = useRouter()
const style = computed<LoginStyle>(() => (route.query.style === 'glass' ? 'glass' : 'split'))

function switchStyle(next: LoginStyle): void {
  void router.replace({ query: { ...route.query, style: next } })
}

const formRef = ref<HTMLElement | null>(null)

// 跨 shadow 提交：oas-form 内部 <form> 在 shadowRoot 里
function requestSubmit(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

// 登录即本地直登 + 手动跳转（replace 对齐 react 版 navigate(..., { replace: true })）
function onSubmit(e: Event): void {
  const { values } = (e as CustomEvent<LoginSubmitDetail>).detail
  useSessionStore().login(values.name || '用户', values.role === 'viewer' ? 'viewer' : 'admin')
  void router.replace(appRoutes[0].path)
}

const rules = computed(() =>
  JSON.stringify({ name: [{ required: true, message: t('login.rule.name') }] }),
)
const roleOptions = computed(() =>
  JSON.stringify([
    { label: t('users.role.admin'), value: 'admin' },
    { label: t('profile.roleViewer'), value: 'viewer' },
  ]),
)
</script>

<template>
  <div v-if="style === 'glass'" class="login-glass">
    <div class="glass-card" data-theme="dark">
      <!-- 与 vanilla formBlock() / react formBlock 逐行对齐（split 分支同款，见下） -->
      <div class="login-head">
        <span class="oas-logo oas-logo-light">
          <span class="oas-logo-badge">OAS</span>
          <span class="oas-logo-word">OAS Admin Pro</span>
        </span>
      </div>
      <h2 class="login-title">{{ t('login.welcome') }}</h2>
      <p class="login-sub">{{ t('login.subtitle') }}</p>
      <oas-form id="login-form" ref="formRef" :rules="rules" @oas-submit="onSubmit">
        <div class="login-fields">
          <oas-input
            data-testid="login-name"
            name="name"
            :placeholder="t('login.namePlaceholder')"
            @oas-enter="requestSubmit"
          />
          <oas-select data-testid="login-role" name="role" value="admin" :options="roleOptions" />
          <oas-button data-testid="login-submit" type="primary" block @click="requestSubmit">
            {{ t('login.submit') }} <oas-icon name="arrow-right" size="14" />
          </oas-button>
        </div>
      </oas-form>
      <div class="login-divider" />
      <p class="login-tip">{{ t('login.tip') }}</p>
    </div>
    <div class="glass-foot">
      <p class="glass-slogan">{{ t('login.glassSlogan') }}</p>
      <button class="link-btn link-btn-light" type="button" @click="switchStyle('split')">
        {{ t('login.switchSplit') }}
      </button>
    </div>
  </div>
  <div v-else class="login-split">
    <div class="login-brand">
      <div class="login-brand-main">
        <span class="oas-logo oas-logo-light">
          <span class="oas-logo-badge">OAS</span>
          <span class="oas-logo-word">OAS Admin Pro</span>
        </span>
        <h1>{{ t('login.slogan') }}</h1>
        <p>{{ t('login.sloganSub') }}</p>
        <div class="brand-stats">
          <div class="brand-stat">
            <span class="num">117</span>
            <span class="label">{{ t('login.statComponents') }}</span>
          </div>
          <div class="brand-stat">
            <span class="num">22KB</span>
            <span class="label">{{ t('login.statBundle') }}</span>
          </div>
          <div class="brand-stat">
            <span class="num">0</span>
            <span class="label">{{ t('login.statFrameworks') }}</span>
          </div>
        </div>
      </div>
      <pre class="brand-code">&lt;oas-button type="primary"&gt;{{ t('common.save') }}&lt;/oas-button&gt;</pre>
    </div>
    <div class="login-panel">
      <div class="login-card">
        <div class="login-head">
          <span class="oas-logo oas-logo-light">
            <span class="oas-logo-badge">OAS</span>
            <span class="oas-logo-word">OAS Admin Pro</span>
          </span>
        </div>
        <h2 class="login-title">{{ t('login.welcome') }}</h2>
        <p class="login-sub">{{ t('login.subtitle') }}</p>
        <oas-form id="login-form" ref="formRef" :rules="rules" @oas-submit="onSubmit">
          <div class="login-fields">
            <oas-input
              data-testid="login-name"
              name="name"
              :placeholder="t('login.namePlaceholder')"
              @oas-enter="requestSubmit"
            />
            <oas-select data-testid="login-role" name="role" value="admin" :options="roleOptions" />
            <oas-button data-testid="login-submit" type="primary" block @click="requestSubmit">
              {{ t('login.submit') }} <oas-icon name="arrow-right" size="14" />
            </oas-button>
          </div>
        </oas-form>
        <div class="login-divider" />
        <p class="login-tip">{{ t('login.tip') }}</p>
        <button class="link-btn login-alt" type="button" @click="switchStyle('glass')">
          {{ t('login.switchGlass') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 登录页样式（自 app.css 迁入）：双版式（split/glass）专属规则；.link-btn 基类仍留全局（多组件共用） */
.login-split {
  min-height: 100%;
  display: flex;
  flex: 1;
}
.login-brand {
  position: relative;
  flex: 1.2;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 64px;
  overflow: hidden;
  background-color: #0a0f1e;
  background-image:
    radial-gradient(circle at 18% 12%, rgba(11, 108, 255, 0.25), transparent 40%),
    radial-gradient(circle at 82% 88%, rgba(124, 58, 237, 0.18), transparent 45%),
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.04) 0,
      rgba(255, 255, 255, 0.04) 1px,
      transparent 1px,
      transparent 48px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.04) 0,
      rgba(255, 255, 255, 0.04) 1px,
      transparent 1px,
      transparent 48px
    );
  color: #fff;
}
.login-brand-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--oas-space-3);
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
}
.login-brand h1 {
  margin: var(--oas-space-2) 0 0;
  font-size: 28px;
  font-weight: 700;
  color: #fff;
}
.login-brand p {
  margin: 0;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.72);
}
.brand-stats {
  display: flex;
  gap: var(--oas-space-6);
  margin-top: var(--oas-space-3);
  flex-wrap: wrap;
  justify-content: center;
}
.brand-stat {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-1);
}
.brand-stat .num {
  font-family: var(--app-mono);
  font-size: 24px;
  font-weight: 650;
  color: #9ecdff;
}
.brand-stat .label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}
.brand-code {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 48px;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
  font-family: var(--app-mono);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre;
  tab-size: 2;
  color: rgba(255, 255, 255, 0.5);
}

.login-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: var(--oas-space-6);
  background: linear-gradient(180deg, var(--oas-color-bg) 0%, var(--oas-color-bg-hover) 100%);
}
.login-card {
  width: min(400px, 100%);
  padding: 32px;
  border-radius: 16px;
  background: var(--oas-color-bg-elevated);
  border: 1px solid var(--oas-color-border);
  box-shadow: 0 12px 40px rgba(11, 108, 255, 0.1);
}

.login-title {
  margin: var(--oas-space-3) 0 var(--oas-space-1);
  font-size: 18px;
  font-weight: 650;
  color: var(--oas-color-text-primary);
}
.login-sub {
  margin: 0 0 var(--oas-space-4);
  font-size: 13px;
  color: var(--oas-color-text-secondary);
}
.login-fields {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-3);
}
.login-fields oas-input,
.login-fields oas-select {
  width: 100%;
}
.login-divider {
  height: 1px;
  margin: var(--oas-space-4) 0 var(--oas-space-3);
  background: var(--oas-color-border);
}
.login-tip {
  margin: 0 0 var(--oas-space-2);
  font-size: 12px;
  color: var(--oas-color-text-secondary);
  text-align: center;
}

.link-btn-light {
  color: #9ecdff;
}

.login-glass {
  min-height: 100%;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--oas-space-3);
  padding: var(--oas-space-6);
  background-color: #0a0f1e;
  background-image:
    radial-gradient(1400px 720px at 50% -180px, rgba(11, 108, 255, 0.3), transparent 70%),
    radial-gradient(
      1000px 800px at calc(100% - 240px) calc(100% - 200px),
      rgba(124, 58, 237, 0.22),
      transparent 70%
    ),
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.04) 0,
      rgba(255, 255, 255, 0.04) 1px,
      transparent 1px,
      transparent 48px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.04) 0,
      rgba(255, 255, 255, 0.04) 1px,
      transparent 1px,
      transparent 48px
    );
  --oas-color-border: rgba(255, 255, 255, 0.28);
  --oas-color-bg: rgba(255, 255, 255, 0.08);
}
.login-glass oas-button {
  --oas-color-primary: #0b6cff;
  --oas-color-text-on-primary: #ffffff;
  --oas-color-primary-hover: color-mix(in srgb, #0b6cff 85%, black);
  --oas-color-primary-active: color-mix(in srgb, #0b6cff 75%, black);
}
.glass-card {
  width: min(400px, 100%);
  padding: 36px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
}
.glass-card .login-head {
  display: flex;
  justify-content: center;
}
.glass-card .login-title {
  color: #fff;
  text-align: center;
}
.glass-card .login-sub {
  color: rgba(255, 255, 255, 0.65);
  text-align: center;
}
.glass-card .login-divider {
  background: rgba(255, 255, 255, 0.14);
}
.glass-card .login-tip {
  color: rgba(255, 255, 255, 0.55);
}
.glass-slogan {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
}
.glass-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--oas-space-2);
  margin-top: var(--oas-space-4);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
}
.glass-foot .link-btn-light {
  color: rgba(255, 255, 255, 0.65);
}

@media (max-width: 879px) {
  .login-split {
    flex-direction: column;
  }
  .login-brand {
    flex: none;
    height: 160px;
    padding: var(--oas-space-4);
    justify-content: flex-start;
  }
  .login-brand h1,
  .login-brand p,
  .brand-stats,
  .brand-code {
    display: none;
  }
  .login-panel {
    padding: var(--oas-space-4);
  }
}
</style>
