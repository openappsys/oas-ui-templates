// 移动端 H5 最小骨架：app-bar + bottom-navigation(pill) + bottom-sheet 发布表单
// 单页三视图（首页/我的）+ float-button 触发发布 sheet；数据为内存 mock，刷新还原
import './styles/app.css'

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

const VIEW_TITLES: Record<string, string> = { home: 'OAS Mobile', mine: '我的' }

let feed: FeedItem[] = [...feedSeed]

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <oas-app-bar heading="${VIEW_TITLES.home}" elevated hide-on-scroll>
      <oas-icon slot="leading" name="menu" />
      <oas-tag slot="actions" size="small">H5</oas-tag>
    </oas-app-bar>
    <main class="view" id="view-home">
      <div id="feed-list"></div>
    </main>
    <main class="view" id="view-mine" hidden>
      <div class="settings-group">
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
        { "label": "我的", "value": "mine", "icon": "user" }
      ]'
    ></oas-bottom-navigation>`

  const appBar = el(root, 'oas-app-bar')
  const nav = el<HTMLElement>(root, '[data-testid="bottom-nav"]')
  const sheet = el(root, '[data-testid="publish-sheet"]')
  const fab = el(root, '[data-testid="publish-fab"]')
  const viewHome = el(root, '#view-home')
  const viewMine = el(root, '#view-mine')
  const feedList = el(root, '#feed-list')

  function renderFeed(): void {
    feedList.innerHTML = feed
      .map(
        (item) => `
      <oas-card class="feed-card">
        <div style="padding: 12px 14px">
          <p class="feed-title">${item.title}</p>
          <div>${item.summary}</div>
          <div class="feed-meta">
            <oas-tag size="small">${item.tag}</oas-tag>
            <span>${item.time}</span>
          </div>
        </div>
      </oas-card>`,
      )
      .join('')
  }

  function switchView(value: string): void {
    const isHome = value !== 'mine'
    viewHome.hidden = !isHome
    viewMine.hidden = isHome
    appBar.setAttribute('heading', VIEW_TITLES[isHome ? 'home' : 'mine'])
  }

  function openSheet(): void {
    sheet.setAttribute('open', '')
  }

  function closeSheet(): void {
    sheet.removeAttribute('open')
  }

  nav.addEventListener('oas-change', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (value) switchView(value)
  })

  fab.addEventListener('click', openSheet)

  el(root, '[data-testid="publish-cancel"]').addEventListener('click', closeSheet)

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
    closeSheet()
    switchView('home')
    nav.setAttribute('value', 'home')
    renderFeed()
  })

  renderFeed()
}
