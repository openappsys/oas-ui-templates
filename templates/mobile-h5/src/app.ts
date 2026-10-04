// 移动端 H5 最小骨架：app-bar + bottom-navigation(pill) + bottom-sheet 发布表单
// hash 路由（#/home /#/list /#/mine）：页面可直达、物理返回键可用（移动 H5 分水岭）；
// 数据为内存 mock，刷新还原

function el<T extends HTMLElement = HTMLElement>(scope: ParentNode, sel: string): T {
  return scope.querySelector<T>(sel)!
}

interface FeedItem {
  title: string
  summary: string
  tag: string
  time: string
}

const feedSeed: FeedItem[] = [
  {
    title: 'oas-ui 2.5.7 发布',
    summary: 'swatch 色板、upload 裁剪、form 大批次增强——移动端 flyout 子菜单同步落地。',
    tag: '公告',
    time: '今天 10:20',
  },
  {
    title: '移动端专项回顾',
    summary: 'bottom-sheet / app-bar / bottom-navigation 三件套 + 触摸目标 44px 全局抬升。',
    tag: '动态',
    time: '昨天 18:03',
  },
  {
    title: '模板仓新成员',
    summary: 'mobile-h5 最小骨架上线：零框架直接消费 web components 的移动端起点。',
    tag: '动态',
    time: '昨天 09:41',
  },
]

const VIEW_TITLES: Record<string, string> = {
  home: 'OAS Mobile',
  list: '全部内容',
  mine: '我的',
}

const ROUTES = ['home', 'list', 'mine'] as const
type Route = (typeof ROUTES)[number]

let feed: FeedItem[] = [...feedSeed]
let currentRoute: Route = 'home'

function currentHashRoute(): Route {
  const raw = location.hash.replace(/^#\//, '')
  return (ROUTES as readonly string[]).includes(raw) ? (raw as Route) : 'home'
}

function feedCardHTML(item: FeedItem): string {
  return `
    <oas-card class="feed-card">
      <div style="padding: 12px 14px">
        <p class="feed-title">${item.title}</p>
        <div>${item.summary}</div>
        <div class="feed-meta">
          <oas-tag size="small">${item.tag}</oas-tag>
          <span>${item.time}</span>
        </div>
      </div>
    </oas-card>`
}

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <oas-app-bar heading="${VIEW_TITLES.home}" elevated hide-on-scroll>
      <oas-icon slot="leading" name="menu" />
      <oas-tag slot="actions" size="small">H5</oas-tag>
    </oas-app-bar>
    <main class="view" id="view-home">
      <div id="feed-list"></div>
    </main>
    <main class="view" id="view-list" hidden>
      <oas-input
        data-testid="list-search"
        placeholder="搜索标题"
        prefix-icon="search"
        clearable
      ></oas-input>
      <div class="filter-chips" data-testid="list-chips">
        <oas-tag class="chip is-on" data-tag="全部">全部</oas-tag>
        <oas-tag class="chip" data-tag="公告">公告</oas-tag>
        <oas-tag class="chip" data-tag="动态">动态</oas-tag>
        <oas-tag class="chip" data-tag="新发布">新发布</oas-tag>
      </div>
      <div id="list-body"></div>
      <div id="list-empty" data-testid="list-empty" hidden>
        <oas-empty description="没有匹配的内容"></oas-empty>
      </div>
    </main>
    <main class="view" id="view-mine" hidden>
      <div class="settings-group">
        <div class="setting-item" data-testid="skin-picker">
          <span>皮肤</span>
          <div class="skin-chips">
            <oas-tag class="chip" data-skin="">默认</oas-tag>
            <oas-tag class="chip" data-skin="violet">堇紫</oas-tag>
            <oas-tag class="chip" data-skin="emerald">靛绿</oas-tag>
            <oas-tag class="chip" data-skin="rose">玫红</oas-tag>
            <oas-tag class="chip" data-skin="teal">青瞳</oas-tag>
          </div>
        </div>
        <div class="setting-item">
          <span>深色模式</span>
          <span class="setting-value">跟随系统</span>
        </div>
        <div class="setting-item">
          <span>消息通知</span>
          <oas-switch checked></oas-switch>
        </div>
        <div class="setting-item">
          <span>字号</span>
          <span class="setting-value">标准</span>
        </div>
        <div class="setting-item">
          <span>清除缓存</span>
          <span class="setting-value">2.1 MB</span>
        </div>
      </div>
      <div class="settings-group">
        <div class="setting-item">
          <span>关于</span>
          <span class="setting-value">OAS Mobile 0.1.0</span>
        </div>
      </div>
    </main>
    <oas-float-button icon="plus" aria-label="发布" data-testid="publish-fab"></oas-float-button>
    <oas-bottom-sheet id="publish-sheet" data-testid="publish-sheet" max-height="80vh">
      <div class="sheet-form">
        <oas-input
          data-testid="publish-title"
          label="标题"
          placeholder="一句话说明你要发布的内容"
          clearable
        ></oas-input>
        <oas-textarea
          data-testid="publish-content"
          label="内容"
          rows="3"
          placeholder="补充细节（可选）"
        ></oas-textarea>
        <div class="sheet-actions">
          <oas-button data-testid="publish-cancel">取消</oas-button>
          <oas-button data-testid="publish-submit" type="primary">发布</oas-button>
        </div>
      </div>
    </oas-bottom-sheet>
    <oas-bottom-navigation
      data-testid="bottom-nav"
      value="home"
      pill
      items='[
        { "label": "首页", "value": "home", "icon": "eye" },
        { "label": "列表", "value": "list", "icon": "filter" },
        { "label": "我的", "value": "mine", "icon": "user" }
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

  // 皮肤持久化与切换（data-skin 与 data-theme 正交；切换清 inline 自定义主色）
  const SKIN_KEY = 'oas-admin.settings.skin'
  const applySkin = (skin: string): void => {
    if (skin) document.documentElement.dataset.skin = skin
    else delete document.documentElement.dataset.skin
  }
  applySkin(localStorage.getItem(SKIN_KEY) ?? '')
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
    appBar.setAttribute('heading', VIEW_TITLES[route])
    nav.setAttribute('value', route)
    if (route === 'list') renderList()
  }

  function navigate(route: Route): void {
    if (currentRoute === route) return
    location.hash = `#/${route}`
  }

  // hash 路由统一驱动：导航点击 / 深链 / 物理返回键全部走 hashchange
  window.addEventListener('hashchange', () => applyRoute(currentHashRoute()))

  nav.addEventListener('oas-change', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (value) navigate(value as Route)
  })

  fab.addEventListener('click', () => sheet.setAttribute('open', ''))

  el(root, '[data-testid="publish-cancel"]').addEventListener('click', () =>
    sheet.removeAttribute('open'),
  )

  // 表单值走 oas-input 事件存 state（oas-input 宿主不反射 value property）
  let draftTitle = ''
  let draftContent = ''
  el(root, '[data-testid="publish-title"]').addEventListener('oas-input', (e) => {
    draftTitle = (e as CustomEvent<{ value: string }>).detail.value ?? ''
  })
  el(root, '[data-testid="publish-title"]').addEventListener('oas-clear', () => {
    draftTitle = ''
  })
  el(root, '[data-testid="publish-content"]').addEventListener('oas-input', (e) => {
    draftContent = (e as CustomEvent<{ value: string }>).detail.value ?? ''
  })

  el(root, '[data-testid="publish-submit"]').addEventListener('click', () => {
    const title = draftTitle.trim()
    if (!title) return
    feed = [
      { title, summary: draftContent.trim() || '刚刚由移动端发布。', tag: '新发布', time: '刚刚' },
      ...feed,
    ]
    draftTitle = ''
    draftContent = ''
    for (const sel of ['[data-testid="publish-title"]', '[data-testid="publish-content"]']) {
      el(root, sel).removeAttribute('value')
    }
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
