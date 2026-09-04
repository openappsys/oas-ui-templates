import { currentLocale, setLocale, t } from './i18n.js'
import { clearSession } from './session.js'

const NAV = [
  { href: './dashboard.html', icon: 'star', key: 'nav.dashboard' },
  { href: './users.html', icon: 'user', key: 'nav.users' },
  { href: './form.html', icon: 'form', key: 'nav.form' },
]

// 接线壳层行为：侧栏 items 按 locale 重灌 + 语言切换 + 登出 + 导航
// 壳的静态结构在各页面 HTML 里（MPA 原始做法），此处只做 HTML 做不到的事
// active：当前页路径（如 './users.html'），须与 NAV href 逐字节全等（组件全等匹配）
export function initShell({ active }) {
  const nav = document.querySelector('#nav')
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

  document.querySelector('#lang-toggle').addEventListener('click', () => {
    setLocale(currentLocale() === 'en' ? 'zh-CN' : 'en')
    location.reload()
  })
  document.querySelector('#nav-toggle').addEventListener('click', () => {
    const nav = document.querySelector('#nav')
    if (nav.hasAttribute('drawer-open')) nav.closeDrawer()
    else nav.openDrawer()
  })
  document.querySelector('#logout').addEventListener('click', () => {
    clearSession()
    location.href = './index.html'
  })
}
