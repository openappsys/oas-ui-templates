<script lang="ts">
  // src/pages/profile.svelte —— 个人中心（账户信息 + 外观主题预览 + 退出登录）
  // 1. 全声明式：session 单例读取 + useT() 订阅 locale，descriptions 的 label/登录时间随重渲重算
  // 2. 主题预览：挂载/卸载 themechange 监听（$effect），is-selected 由 state 派生；applyTheme
  //    与 header 主题点同款（system=清 data-theme 跟随系统 + info 提示），并广播 themechange
  // 3. 退出登录走 src/lib/session-actions.ts 的 logoutFlow()（头部用户菜单同一条闭环）
  import '../styles/pages/profile.css'
  import { appMessage } from '../lib/app-message'
  import { logoutFlow } from '../lib/session-actions'
  import { useT } from '../lib/use-t.svelte'
  import { session } from '../store/session'

  type ThemeChoice = 'light' | 'dark' | 'system'

  function formatLoginAt(n: number | null, locale: string): string {
    if (!n) return '-'
    const tag = locale === 'en' ? 'en-US' : 'zh-CN'
    return new Intl.DateTimeFormat(tag, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(n))
  }

  /** vanilla currentTheme：data-theme 缺省即跟随系统 */
  function readTheme(): ThemeChoice {
    if (document.documentElement.dataset.theme === 'dark') return 'dark'
    if (document.documentElement.dataset.theme === 'light') return 'light'
    return 'system'
  }

  const THEME_PREVIEWS: Array<{
    theme: ThemeChoice
    cls: string
    mini: string
    ariaKey: string
    labelKey: string
  }> = [
    {
      theme: 'light',
      cls: 'is-light',
      mini: 'light-mini',
      ariaKey: 'profile.theme.light',
      labelKey: 'cmd.light',
    },
    {
      theme: 'dark',
      cls: 'is-dark',
      mini: 'dark-mini',
      ariaKey: 'profile.theme.dark',
      labelKey: 'cmd.dark',
    },
    {
      theme: 'system',
      cls: 'is-system',
      mini: 'system-mini',
      ariaKey: 'profile.theme.system',
      labelKey: 'cmd.system',
    },
  ]

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  const user = session.user
  const name = user?.name ?? ''
  const roleLabel = $derived.by(() => {
    void $locale
    return user?.role === 'admin' ? t('users.role.admin') : t('profile.roleViewer')
  })

  let theme = $state<ThemeChoice>(readTheme())

  // themechange 广播（header 主题点/本页 applyTheme）→ 同步预览选中态
  $effect(() => {
    const sync = () => (theme = readTheme())
    document.addEventListener('themechange', sync)
    return () => document.removeEventListener('themechange', sync)
  })

  function applyTheme(next: ThemeChoice): void {
    if (next === 'system') {
      delete document.documentElement.dataset.theme
      appMessage.info(t('profile.systemThemeMsg'))
    } else {
      document.documentElement.dataset.theme = next
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
  }

  const loginAtText = $derived.by(() => {
    void $locale
    return formatLoginAt(session.loginAt, $locale)
  })
</script>

<div class="page">
  <h1 class="page-title">{tt('nav.profile')}</h1>
  <div class="profile-layout">
    <oas-card class="profile-left">
      <div class="profile-avatar-wrap">
        <oas-avatar id="profile-avatar" size="64">
          <span slot="fallback" id="profile-avatar-text" class="profile-avatar-fallback">
            {name.charAt(0).toUpperCase()}
          </span>
        </oas-avatar>
        <div id="profile-name" class="profile-name">{name}</div>
        <oas-tag id="profile-role-tag" type="primary">{roleLabel}</oas-tag>
      </div>
      <oas-divider></oas-divider>
      <div class="profile-logout-wrap">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <oas-button id="profile-logout" type="danger" variant="text" onclick={() => logoutFlow()}>
          {tt('header.logout')}
        </oas-button>
      </div>
    </oas-card>
    <oas-card class="profile-right" title={tt('profile.accountInfo')}>
      <oas-descriptions column="2">
        <oas-descriptions-item label={tt('profile.username')}>
          <span id="profile-name2">{name}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('profile.role')}>
          <span id="profile-role2">{roleLabel}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('profile.loginAt')}>
          <span id="profile-login-at">{loginAtText}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('profile.dataVersion')}>
          <span>{tt('profile.demoData')}</span>
        </oas-descriptions-item>
      </oas-descriptions>
    </oas-card>
  </div>
  <oas-card class="profile-theme" title={tt('profile.appearance')}>
    <div class="theme-previews">
      {#each THEME_PREVIEWS as p (p.theme)}
        <button
          type="button"
          class={`theme-preview ${p.cls}${theme === p.theme ? ' is-selected' : ''}`}
          data-theme={p.theme}
          aria-label={tt(p.ariaKey)}
          onclick={() => applyTheme(p.theme)}
        >
          <span class={`preview-mini ${p.mini}`}></span>
          <span class="preview-label">{tt(p.labelKey)}</span>
        </button>
      {/each}
    </div>
  </oas-card>
</div>
