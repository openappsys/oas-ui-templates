// 桌面体验模板：壁纸 + 桌面图标 + 窗口管理器（拖动/最小化/最大化/焦点）+ 任务栏
// 应用 = 后台能力的窗口化（仪表盘/订单/用户/设置）；oas-* 组件消费 + 自研窗口壳

function el<T extends HTMLElement = HTMLElement>(scope: ParentNode, sel: string): T {
  return scope.querySelector<T>(sel)!
}

type AppId = 'dashboard' | 'orders' | 'users' | 'settings'

interface AppDef {
  id: AppId
  title: string
  icon: string
  width: number
  height: number
}

const APPS: AppDef[] = [
  { id: 'dashboard', title: '仪表盘', icon: 'eye', width: 720, height: 480 },
  { id: 'orders', title: '订单管理', icon: 'calendar', width: 780, height: 500 },
  { id: 'users', title: '用户管理', icon: 'user', width: 700, height: 460 },
  { id: 'settings', title: '设置', icon: 'gear', width: 560, height: 420 },
]

const APP_MAP = new Map(APPS.map((a) => [a.id, a]))

const ORDERS = [
  { no: 'SO-10001', customer: '华信科技', amount: '¥ 12,800', status: '已完成', ok: true },
  { no: 'SO-10002', customer: '蓝海贸易', amount: '¥ 8,600', status: '配送中', ok: false },
  { no: 'SO-10003', customer: '星野文化', amount: '¥ 3,200', status: '待支付', ok: false },
  { no: 'SO-10004', customer: '南山电子', amount: '¥ 21,500', status: '已完成', ok: true },
  { no: 'SO-10005', customer: '启明医疗', amount: '¥ 15,900', status: '配送中', ok: false },
]

const USERS = [
  { name: '张伟', role: '管理员', dept: '平台组', on: true },
  { name: '李娜', role: '运营', dept: '业务组', on: true },
  { name: '王强', role: '访客', dept: '外部', on: false },
  { name: '赵敏', role: '运营', dept: '业务组', on: true },
  { name: '刘洋', role: '管理员', dept: '平台组', on: false },
]

let zTop = 100
const openWindows = new Map<AppId, { el: HTMLElement; minimized: boolean; maximized: boolean }>()

function appBodyHTML(id: AppId): string {
  if (id === 'dashboard') {
    return `
      <div class="stat-grid">
        <div class="stat-card"><span class="stat-label">今日访问</span><b>12,480</b><span class="stat-delta up">+12.4%</span></div>
        <div class="stat-card"><span class="stat-label">新增用户</span><b>328</b><span class="stat-delta up">+8.2%</span></div>
        <div class="stat-card"><span class="stat-label">订单量</span><b>1,926</b><span class="stat-delta up">+3.1%</span></div>
        <div class="stat-card"><span class="stat-label">转化率</span><b>4.6%</b><span class="stat-delta down">-0.4%</span></div>
      </div>
      <oas-card class="panel-card">
        <div class="panel-pad">
          <p class="panel-title">最近订单</p>
          ${ORDERS.slice(0, 3)
            .map(
              (o) =>
                `<div class="row"><span>${o.no}</span><span>${o.customer}</span><span>${o.amount}</span><oas-tag size="small" type="${o.ok ? 'success' : 'warning'}">${o.status}</oas-tag></div>`,
            )
            .join('')}
        </div>
      </oas-card>`
  }
  if (id === 'orders') {
    return `
      <div class="toolbar"><oas-input placeholder="搜索订单号 / 客户" prefix-icon="search" clearable></oas-input><oas-button type="primary" size="small">导出</oas-button></div>
      <div class="thead"><span>订单号</span><span>客户</span><span>金额</span><span>状态</span></div>
      ${ORDERS.map(
        (o) =>
          `<div class="trow"><span>${o.no}</span><span>${o.customer}</span><span>${o.amount}</span><oas-tag size="small" type="${o.ok ? 'success' : 'warning'}">${o.status}</oas-tag></div>`,
      ).join('')}`
  }
  if (id === 'users') {
    return `
      <div class="thead"><span>用户</span><span>角色</span><span>部门</span><span>启用</span></div>
      ${USERS.map(
        (u) =>
          `<div class="trow"><span>${u.name}</span><oas-tag size="small">${u.role}</oas-tag><span>${u.dept}</span><oas-switch ${u.on ? 'checked' : ''}></oas-switch></div>`,
      ).join('')}`
  }
  // settings
  const skin = localStorage.getItem('oas-admin.settings.skin') ?? ''
  const glassOn = localStorage.getItem('oas-admin.settings.glass') === 'on'
  return `
    <p class="group-title">外观</p>
    <div class="setting-item"><span>皮肤</span>
      <div class="skin-chips" id="dt-skin">
        <oas-tag class="chip${skin === '' ? ' is-on' : ''}" data-skin="">默认</oas-tag>
        <oas-tag class="chip${skin === 'violet' ? ' is-on' : ''}" data-skin="violet">堇紫</oas-tag>
        <oas-tag class="chip${skin === 'emerald' ? ' is-on' : ''}" data-skin="emerald">靛绿</oas-tag>
        <oas-tag class="chip${skin === 'rose' ? ' is-on' : ''}" data-skin="rose">玫红</oas-tag>
        <oas-tag class="chip${skin === 'teal' ? ' is-on' : ''}" data-skin="teal">青瞳</oas-tag>
      </div>
    </div>
    <div class="setting-item"><span>玻璃质感</span><oas-switch id="dt-glass"${glassOn ? ' checked' : ''}></oas-switch></div>
    <div class="setting-item"><span>深色模式</span><span class="setting-value">跟随系统</span></div>
    <p class="group-title">关于</p>
    <div class="setting-item"><span>OAS Desktop</span><span class="setting-value">v0.1.0</span></div>`
}

function bindAppBody(win: HTMLElement, id: AppId): void {
  if (id !== 'settings') return
  const applySkin = (skin: string): void => {
    if (skin) document.documentElement.dataset.skin = skin
    else delete document.documentElement.dataset.skin
  }
  applySkin(localStorage.getItem('oas-admin.settings.skin') ?? '')
  const glassSwitch = el<HTMLElement>(win, '#dt-glass')
  if (localStorage.getItem('oas-admin.settings.glass') === 'on')
    glassSwitch.setAttribute('checked', '')
  glassSwitch.addEventListener('oas-change', () => {
    const on = glassSwitch.hasAttribute('checked')
    if (on) document.documentElement.setAttribute('data-glass', '')
    else document.documentElement.removeAttribute('data-glass')
    localStorage.setItem('oas-admin.settings.glass', on ? 'on' : 'off')
  })
  el(win, '#dt-skin').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!chip) return
    const skin = chip.dataset.skin ?? ''
    applySkin(skin)
    if (skin) localStorage.setItem('oas-admin.settings.skin', skin)
    else localStorage.removeItem('oas-admin.settings.skin')
    el(win, '#dt-skin')
      .querySelectorAll<HTMLElement>('.chip')
      .forEach((c) => {
        c.classList.toggle('is-on', c === chip)
      })
  })
}

export function mountApp(root: HTMLElement): void {
  document.title = 'OAS Desktop'
  root.innerHTML = `
    <div class="desktop">
      <div class="desktop-icons" data-testid="desktop-icons">
        ${APPS.map(
          (a) => `
        <button class="desktop-icon" type="button" data-app="${a.id}">
          <span class="di-glyph"><oas-icon name="${a.icon}" size="24"></oas-icon></span>
          <span class="di-label">${a.title}</span>
        </button>`,
        ).join('')}
      </div>
      <div class="windows-layer" id="windows-layer"></div>
    </div>
    <div class="start-menu" id="start-menu" hidden>
      ${APPS.map(
        (a) => `
      <button class="start-item" type="button" data-app="${a.id}">
        <oas-icon name="${a.icon}" size="16"></oas-icon>${a.title}
      </button>`,
      ).join('')}
    </div>
    <div class="taskbar">
      <button class="start-btn" type="button" data-testid="start-btn" aria-label="开始">
        <span class="start-logo">OAS</span>
      </button>
      <div class="task-items" id="task-items"></div>
      <span class="task-clock" id="task-clock"></span>
    </div>`

  const layer = el(root, '#windows-layer')
  const taskItems = el(root, '#task-items')
  const startMenu = el(root, '#start-menu')

  // ── 时钟 ──
  const clock = el(root, '#task-clock')
  const tickClock = (): void => {
    clock.textContent = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  tickClock()
  window.setInterval(tickClock, 10_000)

  // ── 窗口管理 ──
  function focusWindow(app: AppId): void {
    const w = openWindows.get(app)
    if (!w) return
    w.el.style.zIndex = String(++zTop)
  }

  function renderTaskbar(): void {
    taskItems.innerHTML = [...openWindows.entries()]
      .map(
        ([id, w]) => `
      <button class="task-item${w.minimized ? '' : ' is-active'}" type="button" data-app="${id}" title="${APP_MAP.get(id)!.title}">
        <oas-icon name="${APP_MAP.get(id)!.icon}" size="14"></oas-icon><span>${APP_MAP.get(id)!.title}</span>
      </button>`,
      )
      .join('')
  }

  function toggleMinimize(app: AppId): void {
    const w = openWindows.get(app)
    if (!w) return
    w.minimized = !w.minimized
    w.el.classList.toggle('is-minimized', w.minimized)
    if (!w.minimized) focusWindow(app)
    renderTaskbar()
  }

  function toggleMaximize(app: AppId): void {
    const w = openWindows.get(app)
    if (!w) return
    w.maximized = !w.maximized
    w.el.classList.toggle('is-maximized', w.maximized)
    w.el.style.left = ''
    w.el.style.top = ''
  }

  function closeWindow(app: AppId): void {
    const w = openWindows.get(app)
    if (!w) return
    w.el.remove()
    openWindows.delete(app)
    renderTaskbar()
  }

  function openWindow(app: AppId): void {
    startMenu.hidden = true
    const existing = openWindows.get(app)
    if (existing) {
      if (existing.minimized) toggleMinimize(app)
      focusWindow(app)
      return
    }
    const def = APP_MAP.get(app)!
    const win = document.createElement('section')
    win.className = 'window'
    win.dataset.app = app
    win.dataset.testid = `window-${app}`
    const cascade = (openWindows.size % 6) * 26
    win.style.width = `${def.width}px`
    win.style.height = `${def.height}px`
    win.style.left = `${90 + cascade}px`
    win.style.top = `${54 + cascade}px`
    win.style.zIndex = String(++zTop)
    win.innerHTML = `
      <header class="titlebar">
        <span class="tb-ico"><oas-icon name="${def.icon}" size="14"></oas-icon></span>
        <span class="tb-title">${def.title}</span>
        <span class="tb-btns">
          <button class="tb-btn" type="button" data-act="min" aria-label="最小化">─</button>
          <button class="tb-btn" type="button" data-act="max" aria-label="最大化">□</button>
          <button class="tb-btn tb-close" type="button" data-act="close" aria-label="关闭">✕</button>
        </span>
      </header>
      <div class="window-body">${appBodyHTML(app)}</div>`
    layer.appendChild(win)
    openWindows.set(app, { el: win, minimized: false, maximized: false })
    bindAppBody(win, app)
    renderTaskbar()

    // 拖动（标题栏；最大化态禁用）
    const titlebar = el<HTMLElement>(win, '.titlebar')
    titlebar.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.tb-btn')) return
      if (openWindows.get(app)?.maximized) return
      const rect = win.getBoundingClientRect()
      const dx = e.clientX - rect.left
      const dy = e.clientY - rect.top
      const move = (ev: PointerEvent): void => {
        win.style.left = `${Math.max(0, ev.clientX - dx)}px`
        win.style.top = `${Math.max(0, ev.clientY - dy)}px`
      }
      const up = (): void => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    })
    win.addEventListener('pointerdown', () => focusWindow(app))

    for (const b of win.querySelectorAll<HTMLButtonElement>('.tb-btn')) {
      b.addEventListener('click', () => {
        const act = b.dataset.act
        if (act === 'min') toggleMinimize(app)
        else if (act === 'max') toggleMaximize(app)
        else closeWindow(app)
      })
    }
  }

  // ── 桌面图标：单击打开 ──
  el(root, '[data-testid="desktop-icons"]').addEventListener('click', (e) => {
    const icon = (e.target as HTMLElement).closest<HTMLElement>('.desktop-icon')
    if (!icon) return
    openWindow(icon.dataset.app as AppId)
  })

  // ── 任务栏按钮：点击还原/最小化 ──
  taskItems.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.task-item')
    if (!btn) return
    toggleMinimize(btn.dataset.app as AppId)
  })

  // ── 开始菜单 ──
  el(root, '[data-testid="start-btn"]').addEventListener('click', () => {
    startMenu.hidden = !startMenu.hidden
  })
  startMenu.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.start-item')
    if (!item) return
    openWindow(item.dataset.app as AppId)
  })
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement
    if (!startMenu.hidden && !t.closest('#start-menu') && !t.closest('.start-btn'))
      startMenu.hidden = true
  })
}
