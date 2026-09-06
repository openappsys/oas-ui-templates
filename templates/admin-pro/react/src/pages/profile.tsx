// src/pages/profile.tsx —— 个人中心（账户信息 + 外观主题预览 + 退出登录）
// 行为事实来源：vanilla-html/src/pages/profile.ts（逐块对齐）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla innerHTML 拼装 + onLocaleChange(refreshText) 逐节点回写；本模版
//    声明式 JSX，useT() 订阅 locale 后重渲染，descriptions 的 label/登录时间随之重算
// 2. 主题选中态：vanilla syncPreviewSelection 手动切 is-selected 类 + document 级
//    themechange 监听（未摘监听，vanilla 页面不重挂载故无泄漏）；本模版 theme 收为 state，
//    useEffect 挂/摘 themechange 监听，is-selected 由 state 派生
// 3. applyTheme：vanilla profile 页本地实现（system=删 data-theme + 提示，其余=写值），
//    与 src/lib/theme.ts 的 applyTheme（恒写值）语义不同——此处逐字对齐 vanilla profile
// 4. 退出登录：vanilla session.logout() + navigate(routes[0].path) + resolve()；本模版走
//    src/lib/session-actions.ts 的 logoutFlow(navigate)（头部用户菜单同一条闭环）
// 5. admin 头像的 --oas-color-primary 自引用：vanilla 原样保留（计算期无效、无副作用），
//    此处照抄不「顺手修复」
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { logoutFlow } from '../lib/session-actions'
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

export default function ProfilePage() {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const user = session.user
  const name = user?.name ?? ''
  const roleLabel = user?.role === 'admin' ? t('users.role.admin') : t('profile.roleViewer')
  const [theme, setTheme] = useState<ThemeChoice>(readTheme)

  // vanilla document.addEventListener('themechange', ...)：外部换肤（头部/命令面板）同步选中态
  useEffect(() => {
    const sync = () => setTheme(readTheme())
    document.addEventListener('themechange', sync)
    return () => document.removeEventListener('themechange', sync)
  }, [])

  // vanilla applyTheme：system=删属性+提示；其余=写属性；随后派发 themechange
  const applyTheme = (next: ThemeChoice) => {
    if (next === 'system') {
      delete document.documentElement.dataset.theme
      appMessage.info(t('profile.systemThemeMsg'))
    } else {
      document.documentElement.dataset.theme = next
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('nav.profile')}</h1>
      <div className="profile-layout">
        <oas-card className="profile-left">
          <div className="profile-avatar-wrap">
            <oas-avatar
              id="profile-avatar"
              size="64"
              style={
                user?.role === 'admin'
                  ? ({ '--oas-color-primary': 'var(--oas-color-primary)' } as React.CSSProperties)
                  : undefined
              }
            >
              <span slot="fallback" id="profile-avatar-text" className="profile-avatar-fallback">
                {name.charAt(0).toUpperCase()}
              </span>
            </oas-avatar>
            <div id="profile-name" className="profile-name">
              {name}
            </div>
            <oas-tag id="profile-role-tag" type="primary">
              {roleLabel}
            </oas-tag>
          </div>
          <oas-divider />
          <div className="profile-logout-wrap">
            <oas-button
              id="profile-logout"
              type="danger"
              variant="text"
              onClick={() => logoutFlow(navigate)}
            >
              {t('header.logout')}
            </oas-button>
          </div>
        </oas-card>
        <oas-card className="profile-right" title={t('profile.accountInfo')}>
          <oas-descriptions column="2">
            <oas-descriptions-item label={t('profile.username')}>
              <span id="profile-name2">{name}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('profile.role')}>
              <span id="profile-role2">{roleLabel}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('profile.loginAt')}>
              <span id="profile-login-at">{formatLoginAt(session.loginAt, locale)}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('profile.dataVersion')}>
              <span>{t('profile.demoData')}</span>
            </oas-descriptions-item>
          </oas-descriptions>
        </oas-card>
      </div>
      <oas-card className="profile-theme" title={t('profile.appearance')}>
        <div className="theme-previews">
          {THEME_PREVIEWS.map((p) => (
            <button
              key={p.theme}
              className={`theme-preview ${p.cls}${theme === p.theme ? ' is-selected' : ''}`}
              data-theme={p.theme}
              aria-label={t(p.ariaKey)}
              onClick={() => applyTheme(p.theme)}
            >
              <span className={`preview-mini ${p.mini}`} />
              <span className="preview-label">{t(p.labelKey)}</span>
            </button>
          ))}
        </div>
      </oas-card>
    </div>
  )
}
