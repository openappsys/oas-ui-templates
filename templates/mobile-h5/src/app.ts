// 移动端 H5：app-bar + bottom-navigation(pill) + bottom-sheet 发布表单 + 左侧抽屉菜单
// hash 路由（#/home /#/list /#/mine）：页面可直达、物理返回键可用（移动 H5 分水岭）；
// 数据为内存 mock，刷新还原；i18n 复用 @oas-ui/i18n（切换 = 持久化 + reload）

import { currentLocale, setLocale, t } from './i18n'
import type { Locale } from './i18n'

function el<T extends HTMLElement = HTMLElement>(scope: ParentNode, sel: string): T {
  return scope.querySelector<T>(sel)!
}

type FeedKind = '公告' | '动态' | '待办' | '新发布'

interface FeedItem {
  title: string
  summary: string
  tag: FeedKind
  time: string
}

const KIND_ICON: Record<FeedKind, string> = {
  公告: 'star-filled',
  动态: 'eye',
  待办: 'clock',
  新发布: 'plus',
}

const KINDS: FeedKind[] = ['公告', '动态', '待办', '新发布']

/** seed 按当前 locale 取文案（kind 内部键保持中文，展示经 t() 换文） */
function buildSeed(): FeedItem[] {
  return [
    {
      title: t('feed.257.title'),
      summary: t('feed.257.summary'),
      tag: '公告',
      time: `${t('time.today')} 10:20`,
    },
    {
      title: t('feed.mobile.title'),
      summary: t('feed.mobile.summary'),
      tag: '动态',
      time: `${t('time.yesterday')} 18:03`,
    },
    {
      title: t('feed.okr.title'),
      summary: t('feed.okr.summary'),
      tag: '待办',
      time: `${t('time.yesterday')} 14:05`,
    },
    {
      title: t('feed.repo.title'),
      summary: t('feed.repo.summary'),
      tag: '动态',
      time: `${t('time.yesterday')} 09:41`,
    },
    {
      title: t('feed.security.title'),
      summary: t('feed.security.summary'),
      tag: '公告',
      time: `${t('time.monday')} 16:32`,
    },
    {
      title: t('feed.upgrade.title'),
      summary: t('feed.upgrade.summary'),
      tag: '待办',
      time: `${t('time.monday')} 11:18`,
    },
  ]
}

const ROUTES = ['home', 'list', 'mine'] as const
type Route = (typeof ROUTES)[number]

let feed: FeedItem[] = buildSeed()
let currentRoute: Route = 'home'

function currentHashRoute(): Route {
  const raw = location.hash.replace(/^#\//, '')
  return (ROUTES as readonly string[]).includes(raw) ? (raw as Route) : 'home'
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return t('hero.greeting.night')
  if (h < 12) return t('hero.greeting.morning')
  if (h < 18) return t('hero.greeting.afternoon')
  return t('hero.greeting.evening')
}

function feedCardHTML(item: FeedItem): string {
  return `
    <oas-card class="feed-card">
      <div class="feed-row">
        <span class="feed-ico ki" data-kind="${item.tag}"><oas-icon name="${KIND_ICON[item.tag]}" size="18"></oas-icon></span>
        <div class="feed-main">
          <p class="feed-title">${item.title}</p>
          <p class="feed-summary">${item.summary}</p>
          <div class="feed-meta">
            <oas-tag size="small">${t(`kind.${item.tag}`)}</oas-tag>
            <span>${item.time}</span>
          </div>
        </div>
      </div>
    </oas-card>`
}

const QUICK_ENTRIES: Array<{ tag: FeedKind | 'all'; label: string; icon: string }> = [
  { tag: '公告', label: 'kind.公告', icon: 'star-filled' },
  { tag: '动态', label: 'kind.动态', icon: 'eye' },
  { tag: '待办', label: 'kind.待办', icon: 'clock' },
  { tag: 'all', label: 'kind.all', icon: 'filter' },
]

export function mountApp(root: HTMLElement): void {
  document.title = t('app.title')
  root.innerHTML = `
    <oas-app-bar heading="${t('app.title')}" elevated hide-on-scroll>
      <button slot="leading" class="menu-btn" type="button" data-testid="menu-btn" aria-label="menu">
        <oas-icon name="menu" />
      </button>
      <oas-tag slot="actions" size="small">H5</oas-tag>
      <a class="portal-link" slot="actions" href="/" title="${t('menu.portal')}">${t('menu.portal')}</a>
    </oas-app-bar>
    <main class="view" id="view-home">
      <section class="hero">
        <div class="hero-text">
          <p class="hero-hi">${greeting()}，张伟</p>
          <p class="hero-sub">${t('hero.sub')}</p>
        </div>
        <span class="hero-glyph"><oas-icon name="star-filled" size="26"></oas-icon></span>
      </section>
      <section class="quick-grid" data-testid="quick-grid">
        ${QUICK_ENTRIES.map(
          (q) => `
        <button class="quick-item" type="button" data-tag="${q.tag}">
          <span class="quick-ico" data-kind="${q.tag === 'all' ? '动态' : q.tag}"><oas-icon name="${q.icon}" size="20"></oas-icon></span>
          <span class="quick-label">${t(q.label)}</span>
        </button>`,
        ).join('')}
      </section>
      <div class="section-head">
        <span class="section-title">${t('section.latest')}</span>
      </div>
      <div id="feed-list"></div>
    </main>
    <main class="view" id="view-list" hidden>
      <oas-input
        data-testid="list-search"
        placeholder="${t('list.search.ph')}"
        prefix-icon="search"
        clearable
      ></oas-input>
      <div class="filter-chips" data-testid="list-chips">
        <oas-tag class="chip is-on" data-tag="全部">${t('kind.all')}</oas-tag>
        ${KINDS.map((k) => `<oas-tag class="chip" data-tag="${k}">${t(`kind.${k}`)}</oas-tag>`).join('')}
      </div>
      <div id="list-body"></div>
      <div id="list-empty" data-testid="list-empty" hidden>
        <oas-empty description="${t('list.empty')}"></oas-empty>
      </div>
    </main>
    <main class="view" id="view-mine" hidden>
      <section class="me-hero">
        <span class="me-avatar">张</span>
        <div class="me-info">
          <p class="me-name">张伟</p>
          <p class="me-team">${t('me.team')}</p>
        </div>
        <oas-tag size="small" type="primary">Pro</oas-tag>
      </section>
      <section class="me-stats">
        <div class="stat"><b>12</b><span>${t('me.posts')}</span></div>
        <div class="stat"><b>48</b><span>${t('me.read')}</span></div>
        <div class="stat"><b>3</b><span>${t('me.todos')}</span></div>
      </section>
      <p class="group-title">${t('group.preferences')}</p>
      <div class="settings-group">
        <div class="setting-item" data-testid="skin-picker">
          <span class="setting-label"><oas-icon name="star-filled" size="16"></oas-icon>${t('setting.skin')}</span>
          <div class="skin-chips">
            <oas-tag class="chip is-on" data-skin="">${t('skin.default')}</oas-tag>
            <oas-tag class="chip" data-skin="violet">${t('skin.violet')}</oas-tag>
            <oas-tag class="chip" data-skin="emerald">${t('skin.emerald')}</oas-tag>
            <oas-tag class="chip" data-skin="rose">${t('skin.rose')}</oas-tag>
            <oas-tag class="chip" data-skin="teal">${t('skin.teal')}</oas-tag>
          </div>
        </div>
        <div class="setting-item" data-testid="glass-toggle">
          <span class="setting-label"><oas-icon name="eye" size="16"></oas-icon>${t('setting.glass')}</span>
          <oas-switch id="glass-switch"></oas-switch>
        </div>
        <div class="setting-item" data-testid="locale-picker">
          <span class="setting-label"><oas-icon name="edit" size="16"></oas-icon>${t('setting.locale')}</span>
          <div class="skin-chips" id="locale-chips">
            <oas-tag class="chip${currentLocale() === 'zh-CN' ? ' is-on' : ''}" data-locale="zh-CN">中文</oas-tag>
            <oas-tag class="chip${currentLocale() === 'en' ? ' is-on' : ''}" data-locale="en">English</oas-tag>
          </div>
        </div>
        <div class="setting-item">
          <span class="setting-label"><oas-icon name="star" size="16"></oas-icon>${t('setting.dark')}</span>
          <span class="setting-value">${t('setting.followSystem')}</span>
        </div>
      </div>
      <p class="group-title">${t('group.general')}</p>
      <div class="settings-group">
        <div class="setting-item">
          <span class="setting-label"><oas-icon name="star" size="16"></oas-icon>${t('setting.notif')}</span>
          <oas-switch checked></oas-switch>
        </div>
        <div class="setting-item">
          <span class="setting-label"><oas-icon name="edit" size="16"></oas-icon>${t('setting.fontSize')}</span>
          <span class="setting-value">${t('setting.standard')}</span>
        </div>
        <div class="setting-item">
          <span class="setting-label"><oas-icon name="clock" size="16"></oas-icon>${t('setting.clearCache')}</span>
          <span class="setting-value">2.1 MB</span>
        </div>
      </div>
      <p class="group-title">${t('group.about')}</p>
      <div class="settings-group">
        <div class="setting-item">
          <span class="setting-label"><oas-icon name="star-filled" size="16"></oas-icon>${t('about.title')}</span>
          <span class="setting-value">OAS Mobile 0.1.0</span>
        </div>
      </div>
    </main>
    <oas-float-button icon="plus" aria-label="${t('common.publish')}" data-testid="publish-fab"></oas-float-button>
    <oas-drawer id="menu-drawer" data-testid="menu-drawer" placement="left" size="small" no-footer>
      <nav class="menu-nav">
        <p class="menu-nav-title">${t('app.title')}</p>
        <button class="menu-link" type="button" data-route="home">
          <oas-icon name="eye" size="16"></oas-icon>${t('nav.home')}
        </button>
        <button class="menu-link" type="button" data-route="list">
          <oas-icon name="filter" size="16"></oas-icon>${t('nav.list')}
        </button>
        <button class="menu-link" type="button" data-route="mine">
          <oas-icon name="user" size="16"></oas-icon>${t('nav.mine')}
        </button>
        <a class="menu-link" href="/">
          <oas-icon name="star" size="16"></oas-icon>${t('menu.portal')}
        </a>
        <div class="menu-foot">oas-ui · v0.1.0</div>
      </nav>
    </oas-drawer>
    <oas-bottom-sheet id="publish-sheet" data-testid="publish-sheet" max-height="80vh">
      <div class="sheet-form">
        <oas-input
          data-testid="publish-title"
          label="${t('publish.title')}"
          placeholder="${t('publish.titlePh')}"
          clearable
        ></oas-input>
        <oas-textarea
          data-testid="publish-content"
          label="${t('publish.content')}"
          rows="3"
          placeholder="${t('publish.contentPh')}"
        ></oas-textarea>
        <div class="sheet-tags">
          <span class="sheet-tags-label">${t('publish.category')}</span>
          <div class="filter-chips" id="publish-tags">
            <oas-tag class="chip is-on" data-tag="新发布">${t('kind.新发布')}</oas-tag>
            ${KINDS.filter((k) => k !== '新发布')
              .map((k) => `<oas-tag class="chip" data-tag="${k}">${t(`kind.${k}`)}</oas-tag>`)
              .join('')}
          </div>
        </div>
        <div class="sheet-actions">
          <oas-button data-testid="publish-cancel">${t('common.cancel')}</oas-button>
          <oas-button data-testid="publish-submit" type="primary">${t('common.publish')}</oas-button>
        </div>
      </div>
    </oas-bottom-sheet>
    <oas-bottom-navigation
      data-testid="bottom-nav"
      value="home"
      pill
      items='[
        { "label": "${t('nav.tab.home')}", "value": "home", "icon": "eye" },
        { "label": "${t('nav.tab.list')}", "value": "list", "icon": "filter" },
        { "label": "${t('nav.tab.mine')}", "value": "mine", "icon": "user" }
      ]'
    ></oas-bottom-navigation>`

  // hash 规范化：初始无 hash（如直接打开 /）时补写 #/home，
  // 保证 URL 恒有路由段——返回键/深链/断言行为一致（replace 不留多余历史）
  if (!location.hash) location.replace(`#/${currentHashRoute()}`)
  const appBar = el(root, 'oas-app-bar')
  const nav = el<HTMLElement>(root, '[data-testid="bottom-nav"]')
  const sheet = el(root, '[data-testid="publish-sheet"]')
  const fab = el(root, '[data-testid="publish-fab"]')
  const viewHome = el(root, '#view-home')
  const viewList = el(root, '#view-list')
  const viewMine = el(root, '#view-mine')
  const feedList = el(root, '#feed-list')
  const listBody = el(root, '#list-body')
  const listEmpty = el(root, '#list-empty')
  const listSearch = el<HTMLInputElement>(root, '[data-testid="list-search"]')

  let listTag = '全部'
  let listQuery = ''
  let publishTag: FeedKind = '新发布'

  // 皮肤持久化与切换（data-skin 与 data-theme 正交；切换清 inline 自定义主色）
  const SKIN_KEY = 'oas-admin.settings.skin'
  const applySkin = (skin: string): void => {
    if (skin) document.documentElement.dataset.skin = skin
    else delete document.documentElement.dataset.skin
  }
  applySkin(localStorage.getItem(SKIN_KEY) ?? '')

  // 玻璃质感持久化与切换（data-glass 浮层磨砂层，默认关；键名对齐 admin-pro 家族）
  const GLASS_KEY = 'oas-admin.settings.glass'
  const applyGlass = (on: boolean): void => {
    if (on) document.documentElement.setAttribute('data-glass', '')
    else document.documentElement.removeAttribute('data-glass')
  }
  const glassOn = localStorage.getItem(GLASS_KEY) === 'on'
  applyGlass(glassOn)
  const glassSwitch = el(root, '#glass-switch')
  if (glassOn) glassSwitch.setAttribute('checked', '')
  glassSwitch.addEventListener('oas-change', () => {
    const on = glassSwitch.hasAttribute('checked')
    applyGlass(on)
    localStorage.setItem(GLASS_KEY, on ? 'on' : 'off')
  })
  el(root, '[data-testid="skin-picker"]').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!chip) return
    const skin = chip.dataset.skin ?? ''
    applySkin(skin)
    if (skin) localStorage.setItem(SKIN_KEY, skin)
    else localStorage.removeItem(SKIN_KEY)
    document.documentElement.style.removeProperty('--oas-color-primary')
    localStorage.removeItem('oas-admin.settings.theme.light')
    localStorage.removeItem('oas-admin.settings.theme.dark')
    el(root, '[data-testid="skin-picker"]')
      .querySelectorAll<HTMLElement>('.chip')
      .forEach((c) => {
        if (c === chip) c.classList.add('is-on')
        else c.classList.remove('is-on')
      })
  })
  el(root, '[data-testid="skin-picker"]')
    .querySelectorAll<HTMLElement>('.chip')
    .forEach((c) => {
      if ((c.dataset.skin ?? '') === (localStorage.getItem(SKIN_KEY) ?? ''))
        c.classList.add('is-on')
    })

  // 语言切换：持久化 + reload（i18n.ts setLocale 统一口径）
  el(root, '[data-testid="locale-picker"]').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!chip) return
    const next = chip.dataset.locale as Locale
    if (!next || next === currentLocale()) return
    setLocale(next)
  })

  // 首页宫格：带筛选跳列表
  el(root, '[data-testid="quick-grid"]').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.quick-item')
    if (!btn) return
    listTag = btn.dataset.tag === 'all' ? '全部' : (btn.dataset.tag ?? '全部')
    navigate('list')
  })

  // 发布分类 chips
  el(root, '#publish-tags').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!chip) return
    publishTag = (chip.dataset.tag as FeedKind) ?? '新发布'
    el(root, '#publish-tags')
      .querySelectorAll<HTMLElement>('.chip')
      .forEach((c) => {
        c.classList.toggle('is-on', c === chip)
      })
  })

  function renderFeed(): void {
    feedList.innerHTML = feed.map(feedCardHTML).join('')
  }

  function renderList(): void {
    const kw = listQuery.trim().toLowerCase()
    const rows = feed.filter(
      (item) =>
        (listTag === '全部' || item.tag === listTag) &&
        (!kw || item.title.toLowerCase().includes(kw) || item.summary.toLowerCase().includes(kw)),
    )
    listBody.innerHTML = rows.map(feedCardHTML).join('')
    listEmpty.hidden = rows.length !== 0
  }

  function applyRoute(route: Route): void {
    currentRoute = route
    viewHome.hidden = route !== 'home'
    viewList.hidden = route !== 'list'
    viewMine.hidden = route !== 'mine'
    appBar.setAttribute('heading', VIEW_TITLE())
    nav.setAttribute('value', route)
    if (route === 'list') {
      // 宫格带筛选进入时同步 chips 选中态
      el(root, '[data-testid="list-chips"]')
        .querySelectorAll<HTMLElement>('.chip')
        .forEach((c) => {
          c.classList.toggle('is-on', (c.dataset.tag ?? '全部') === listTag)
        })
      renderList()
    }
  }

  function VIEW_TITLE(): string {
    return currentRoute === 'list'
      ? t('nav.list')
      : currentRoute === 'mine'
        ? t('nav.mine')
        : t('app.title')
  }

  function navigate(route: Route): void {
    if (currentRoute === route) {
      applyRoute(route)
      return
    }
    location.hash = `#/${route}`
  }

  // hash 路由统一驱动：导航点击 / 深链 / 物理返回键全部走 hashchange
  window.addEventListener('hashchange', () => applyRoute(currentHashRoute()))

  nav.addEventListener('oas-change', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (value) navigate(value as Route)
  })

  fab.addEventListener('click', () => sheet.setAttribute('open', ''))

  // 汉堡 → 左侧抽屉菜单（oas-drawer 开关属性是 visible）；点菜单项导航并收起
  const menuDrawer = el(root, '[data-testid="menu-drawer"]')
  el(root, '[data-testid="menu-btn"]').addEventListener('click', () => {
    menuDrawer.setAttribute('visible', '')
  })
  menuDrawer.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLElement>('.menu-link')
    // 真实链接（如返回模板门户）走浏览器默认导航，不走站内路由
    if (!link || link.tagName === 'A') return
    menuDrawer.removeAttribute('visible')
    navigate((link.dataset.route as Route) ?? 'home')
  })

  el(root, '[data-testid="publish-cancel"]').addEventListener('click', () =>
    sheet.removeAttribute('open'),
  )

  // oas-input 2.5.9 起公开 value property——宿主直读直写，无需事件存 state 样板
  el(root, '[data-testid="publish-submit"]').addEventListener('click', () => {
    const titleInput = el<HTMLInputElement>(root, '[data-testid="publish-title"]')
    const contentInput = el<HTMLInputElement>(root, '[data-testid="publish-content"]')
    const title = (titleInput.value ?? '').trim()
    if (!title) return
    feed = [
      {
        title,
        summary: (contentInput.value ?? '').trim() || '刚刚由移动端发布。',
        tag: publishTag,
        time: '刚刚',
      },
      ...feed,
    ]
    titleInput.value = ''
    contentInput.value = ''
    sheet.removeAttribute('open')
    renderFeed()
    navigate('home')
  })

  listSearch.addEventListener('oas-input', (e) => {
    listQuery = (e as CustomEvent<{ value: string }>).detail.value ?? ''
    renderList()
  })
  listSearch.addEventListener('oas-clear', () => {
    listQuery = ''
    renderList()
  })
  el(root, '[data-testid="list-chips"]').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!chip) return
    listTag = chip.dataset.tag ?? '全部'
    el(root, '[data-testid="list-chips"]')
      .querySelectorAll<HTMLElement>('.chip')
      .forEach((c) => {
        c.classList.toggle('is-on', c === chip)
      })
    renderList()
  })

  renderFeed()
  renderList()
  applyRoute(currentHashRoute())
}
