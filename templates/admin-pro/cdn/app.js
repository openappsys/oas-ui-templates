import { currentLocale, onLocaleChange, setLocale, t } from './i18n.js'
import { matchRoute, routes } from './routes.js'

const SESSION_KEY = 'oas-admin-cdn.session'

// 侧栏分组：与 vanilla app-shell 的 GROUP_ORDER / GROUP_KEYS 逐字对齐
const GROUP_ORDER = ['nav.output', 'nav.business', 'nav.system', 'nav.demo']
const GROUP_KEYS = {
  'nav.output': 'nav.group.overview',
  'nav.business': 'nav.group.business',
  'nav.system': 'nav.group.system',
  'nav.demo': 'nav.group.demo',
}

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
        <oas-select data-testid="login-role" value="admin" options='${JSON.stringify([
          { label: t('users.role.admin'), value: 'admin' },
          { label: t('profile.roleViewer'), value: 'viewer' },
        ])}'></oas-select>
        <oas-button data-testid="login-submit" type="primary">${t('login.submit')}</oas-button>
        <p class="login-tip">${t('login.tip')}</p>
      </div>
    </div>`
  const input = app.querySelector('[data-testid="login-name"]')
  const roleSelect = app.querySelector('[data-testid="login-role"]')
  const submit = () => {
    const name = (input.shadowRoot?.querySelector('input')?.value ?? '').trim()
    if (!name) return
    try {
      // loginAt 供个人中心「登录时间」展示；role 供仪表盘快捷操作 / 用户页只读判断（对齐 vanilla session 语义）
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          name,
          role: roleSelect.getAttribute('value') === 'viewer' ? 'viewer' : 'admin',
          loginAt: Date.now(),
        }),
      )
    } catch {
      /* 隐私模式 */
    }
    location.hash = `#${HOME}`
  }
  app.querySelector('[data-testid="login-submit"]').addEventListener('click', submit)
  input.addEventListener('oas-enter', submit)
}

function renderShell() {
  app.innerHTML = `
    <oas-layout class="app" viewport>
      <header class="app-header" slot="header">
        <button id="nav-toggle" class="nav-toggle" type="button" aria-label="打开菜单">☰</button>
        <!-- logo：OAS 徽标 + 站名，点击回站点首页（门户 /） -->
        <a class="oas-logo" href="/" style="text-decoration: none; color: inherit; cursor: pointer">
          <span class="oas-logo-badge">OAS</span>
          <span class="oas-logo-word">${t('app.title')}</span>
        </a>
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
  app.querySelector('#nav-toggle').addEventListener('click', () => {
    const nav = app.querySelector('#nav')
    if (nav.hasAttribute('drawer-open')) nav.closeDrawer()
    else nav.openDrawer()
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
  // 与 vanilla sidebarItems 同构：过滤隐藏路由 → 按分组排序 → items JSON
  // cdn 过渡期附加过滤 navHidden（/basic-form，见 routes.js 注释）
  const items = routes
    .filter((r) => !r.hidden && !r.navHidden && r.group)
    .slice()
    .sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
        routes.indexOf(a) - routes.indexOf(b),
    )
    .map((r) => ({
      label: t(r.navKey ?? r.titleKey),
      value: r.path,
      icon: r.icon,
      iconColor: r.iconColor,
      group: t(GROUP_KEYS[r.group]),
    }))
  nav.setAttribute('items', JSON.stringify(items))
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
    location.hash = `#${HOME}`
    return
  }
  const route = matchRoute(hash)
  if (!route) {
    // 未知路径与 vanilla guard 语义对齐：送 /not-found（占位页）
    location.hash = '#/not-found'
    return
  }
  if (!app.querySelector('#view')) renderShell()
  syncNav()
  const view = app.querySelector('#view')
  disposePage?.()
  disposePage = route.render(view)
}

window.addEventListener('hashchange', resolve)
resolve()
onLocaleChange(() => {
  if (!session()) return
  resolve()
  app.querySelector('.oas-logo-word').textContent = t('app.title')
  app.querySelector('#lang-toggle').textContent = t('header.lang')
  app.querySelector('#logout').textContent = t('header.logout')
  syncNav()
})
