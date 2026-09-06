<script setup lang="ts">
// src/pages/login.vue —— 登录页：双版式（split/glass）+ oas-form 本地直登
// （app.css 登录页样式依赖这些类名）
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
import { session } from '../store/session'
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
  session.login(values.name || '用户', values.role === 'viewer' ? 'viewer' : 'admin')
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
