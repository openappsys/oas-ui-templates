import { currentLocale, setLocale, t } from './i18n.js'
import { clearSession } from './session.js'

const NAV = [
  { href: './dashboard.html', icon: 'star', key: 'nav.dashboard' },
  { href: './users.html', icon: 'user', key: 'nav.users' },
  { href: './form.html', icon: 'form', key: 'nav.form' },
]

// 渲染 oas-layout 壳（顶栏 + 侧栏 + #view 挂载点）到 #app
// active：当前页路径（如 './users.html'），用于侧栏高亮与导航去重
export function mountShell({ active }) {
  const app = document.querySelector('#app')
  app.innerHTML = `
    <oas-layout class="app" viewport>
      <header class="app-header" slot="header">
        <span class="logo">${t('app.title')}</span>
        <span class="spacer"></span>
        <button id="lang-toggle" data-testid="lang-toggle" class="icon-btn" type="button">${t('header.lang')}</button>
        <button id="logout" class="icon-btn" type="button">${t('header.logout')}</button>
      </header>
      <oas-sider slot="sider">
        <oas-sidebar id="nav"></oas-sidebar>
      </oas-sider>
      <div slot="content" id="view"></div>
    </oas-layout>`

  app.querySelector('#lang-toggle').addEventListener('click', () => {
    setLocale(currentLocale() === 'en' ? 'zh-CN' : 'en')
    location.reload()
  })
  app.querySelector('#logout').addEventListener('click', () => {
    clearSession()
    location.href = './index.html'
  })

  const nav = app.querySelector('#nav')
  nav.setAttribute(
    'items',
    JSON.stringify(
      NAV.map((n) => ({ label: t(n.key), value: n.href, icon: n.icon, group: t('nav.group') })),
    ),
  )
  nav.setAttribute('active', active)
  nav.addEventListener('oas-select', (e) => {
    const value = e.detail?.value
    if (value && value !== active) location.href = value
  })
}
