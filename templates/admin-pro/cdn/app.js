import { currentLocale, onLocaleChange, setLocale, t } from './i18n.js'
import { renderDashboard, renderForm, renderUsers } from './pages.js'

const SESSION_KEY = 'oas-admin-cdn.session'
const ROUTES = {
  '/dashboard': renderDashboard,
  '/users': renderUsers,
  '/form': renderForm,
}
const NAV = [
  { path: '/dashboard', icon: 'star', key: 'nav.dashboard' },
  { path: '/users', icon: 'user', key: 'nav.users' },
  { path: '/form', icon: 'form', key: 'nav.form' },
]

const HOME = '/dashboard'
function parseHash() {
  return location.hash.replace(/^#/, '') || HOME
}

const app = document.querySelector('#app')
let disposePage = null

function session() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

function renderLogin() {
  document.title = `${t('login.title')} · ${t('app.title')}`
  app.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <h1>${t('login.title')}</h1>
        <p class="sub">${t('login.subtitle')}</p>
        <oas-input data-testid="login-name" placeholder="${t('login.namePh')}"></oas-input>
        <oas-button data-testid="login-submit" type="primary">${t('login.submit')}</oas-button>
        <p class="login-tip">${t('login.tip')}</p>
      </div>
    </div>`
  const input = app.querySelector('[data-testid="login-name"]')
  const submit = () => {
    const name = (input.shadowRoot?.querySelector('input')?.value ?? '').trim()
    if (!name) return
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ name }))
    } catch {
      /* 隐私模式 */
    }
    location.hash = '#' + HOME
  }
  app.querySelector('[data-testid="login-submit"]').addEventListener('click', submit)
  input.addEventListener('oas-enter', submit)
}

function renderShell() {
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
  })
  app.querySelector('#logout').addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY)
    location.hash = '#/login'
  })
  app.querySelector('#nav').addEventListener('oas-select', (e) => {
    const value = e.detail?.value
    if (value && location.hash !== `#${value}`) location.hash = value
  })
  syncNav()
}

function syncNav() {
  const nav = app.querySelector('#nav')
  if (!nav) return
  nav.setAttribute(
    'items',
    JSON.stringify(
      NAV.map((n) => ({ label: t(n.key), value: n.path, icon: n.icon, group: t('nav.group') })),
    ),
  )
  nav.setAttribute('active', parseHash())
}

function resolve() {
  const hash = parseHash()
  if (!session()) {
    disposePage?.()
    disposePage = null
    if (hash !== '/login') location.hash = '#/login'
    else renderLogin()
    return
  }
  if (hash === '/login') {
    location.hash = '#' + HOME
    return
  }
  const render = ROUTES[hash]
  if (!render) {
    location.hash = '#' + HOME
    return
  }
  if (!app.querySelector('#view')) renderShell()
  syncNav()
  const view = app.querySelector('#view')
  disposePage?.()
  disposePage = render(view)
}

window.addEventListener('hashchange', resolve)
resolve()
onLocaleChange(() => {
  if (!session()) return
  app.querySelector('.logo').textContent = t('app.title')
  app.querySelector('#lang-toggle').textContent = t('header.lang')
  app.querySelector('#logout').textContent = t('header.logout')
  syncNav()
})
