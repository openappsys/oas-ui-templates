// 桌面软件体验模板：单窗口原生应用式布局
// 自绘标题栏（窗口按钮）+ 菜单栏 + 活动栏（图标导航）+ 侧栏面板 + 内容区 + 状态栏
// 控件消费 oas-* 组件；标题栏/菜单栏为桌面应用观感壳（浏览器内模拟）

function el<T extends HTMLElement = HTMLElement>(scope: ParentNode, sel: string): T {
  return scope.querySelector<T>(sel)!
}

type SectionId = 'dashboard' | 'orders' | 'users' | 'settings' | 'studio'

interface SectionDef {
  id: SectionId
  title: string
  icon: string
  side: Array<{ label: string; hint?: string }>
}

const SECTIONS: SectionDef[] = [
  {
    id: 'dashboard',
    title: '仪表盘',
    icon: 'eye',
    side: [
      { label: '经营总览', hint: '今日核心指标' },
      { label: '访问趋势', hint: '近 30 日' },
      { label: '转化漏斗', hint: '注册 → 付费' },
    ],
  },
  {
    id: 'orders',
    title: '订单管理',
    icon: 'calendar',
    side: [
      { label: '全部订单', hint: '12' },
      { label: '待支付', hint: '1' },
      { label: '配送中', hint: '2' },
      { label: '已完成', hint: '9' },
    ],
  },
  {
    id: 'users',
    title: '用户管理',
    icon: 'user',
    side: [
      { label: '全部用户', hint: '4' },
      { label: '平台组', hint: '2' },
      { label: '业务组', hint: '2' },
      { label: '已停用', hint: '2' },
    ],
  },
  {
    id: 'settings',
    title: '设置',
    icon: 'gear',
    side: [
      { label: '外观', hint: '主题 / 皮肤' },
      { label: '通知', hint: '渠道矩阵' },
      { label: '关于', hint: '版本信息' },
    ],
  },
  {
    id: 'studio',
    title: '创作台',
    icon: 'star-filled',
    side: [
      { label: '人声主轨', hint: '03:42' },
      { label: '和声层', hint: '03:42' },
      { label: '鼓组', hint: '03:38' },
      { label: '采样素材', hint: '12 个' },
    ],
  },
]

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
]

function contentHTML(id: SectionId): string {
  if (id === 'dashboard') {
    return `
      <div class="stat-grid">
        <div class="stat-card"><span class="stat-label">今日访问</span><b>12,480</b><span class="stat-delta up">+12.4%</span></div>
        <div class="stat-card"><span class="stat-label">新增用户</span><b>328</b><span class="stat-delta up">+8.2%</span></div>
        <div class="stat-card"><span class="stat-label">订单量</span><b>1,926</b><span class="stat-delta up">+3.1%</span></div>
        <div class="stat-card"><span class="stat-label">转化率</span><b>4.6%</b><span class="stat-delta down">-0.4%</span></div>
      </div>
      <div class="panel">
        <p class="panel-title">最近订单</p>
        ${ORDERS.slice(0, 4)
          .map(
            (o) =>
              `<div class="trow"><span>${o.no}</span><span>${o.customer}</span><span>${o.amount}</span><oas-tag size="small" type="${o.ok ? 'success' : 'warning'}">${o.status}</oas-tag></div>`,
          )
          .join('')}
      </div>`
  }
  if (id === 'orders') {
    return `
      <div class="toolbar"><oas-input placeholder="搜索订单号 / 客户" prefix-icon="search" clearable></oas-input><oas-button type="primary" size="small">导出</oas-button></div>
      <div class="panel">
        <div class="thead"><span>订单号</span><span>客户</span><span>金额</span><span>状态</span></div>
        ${ORDERS.map(
          (o) =>
            `<div class="trow"><span>${o.no}</span><span>${o.customer}</span><span>${o.amount}</span><oas-tag size="small" type="${o.ok ? 'success' : 'warning'}">${o.status}</oas-tag></div>`,
        ).join('')}
      </div>`
  }
  if (id === 'users') {
    return `
      <div class="toolbar"><oas-input placeholder="搜索用户" prefix-icon="search" clearable></oas-input><oas-button type="primary" size="small">新建用户</oas-button></div>
      <div class="panel">
        <div class="thead"><span>用户</span><span>角色</span><span>部门</span><span>启用</span></div>
        ${USERS.map(
          (u) =>
            `<div class="trow"><span>${u.name}</span><oas-tag size="small">${u.role}</oas-tag><span>${u.dept}</span><oas-switch ${u.on ? 'checked' : ''}></oas-switch></div>`,
        ).join('')}
      </div>`
  }
  const skin = localStorage.getItem('oas-admin.settings.skin') ?? ''
  const glassOn = localStorage.getItem('oas-admin.settings.glass') === 'on'
  return `
    <div class="panel settings-panel">
      <p class="panel-title">外观</p>
      <div class="setting-item"><span>主题色</span><span class="setting-value">跟随皮肤</span></div>
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
    </div>`
}

function studioHTML(): string {
  const total = 222
  const rulerMarks = [0, 30, 60, 90, 120, 150, 180, 210]
  const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return `
    <div class="studio" data-testid="studio">
      <div class="st-toolbar">
        <span class="st-project">未命名项目 · v1</span>
        <span class="st-trackname" data-testid="st-trackname">人声主轨</span>
        <span class="tb-spacer"></span>
        <oas-button size="small">分享</oas-button>
        <oas-button size="small" type="primary">导出</oas-button>
      </div>
      <div class="st-main">
        <div class="st-library">
          <p class="st-panel-title">轨道</p>
          ${STUDIO_TRACKS.map(
            (tr, i) => `
          <div class="st-lib-item${i === 0 ? ' is-active' : ''}" data-track="${tr.name}"><oas-icon name="star" size="13"></oas-icon><span>${tr.name}</span></div>`,
          ).join('')}
          <p class="st-panel-title" style="margin-top:12px">素材库</p>
          ${['贝斯', '采样包 A', '采样包 B', '环境铺底']
            .map(
              (s) =>
                `<div class="st-lib-item" data-asset="${s}"><oas-icon name="star" size="13"></oas-icon><span>${s}</span></div>`,
            )
            .join('')}
        </div>
        <div class="st-center">
          <div class="st-timeline" data-testid="st-timeline">
            <div class="st-ruler">
              ${rulerMarks.map((s) => `<span class="st-mark" style="left:${(s / total) * 100}%">${fmt(s)}</span>`).join('')}
            </div>
            ${STUDIO_TRACKS.map(
              (tr) => `
            <div class="st-lane" data-track="${tr.name}">
              ${tr.clips
                .map(
                  (c) =>
                    `<div class="st-clip" style="left:${(c.start / tr.duration) * 100}%;width:${(c.dur / tr.duration) * 100}%" data-clip="${c.name}" data-start="${c.start}" data-dur="${c.dur}">${c.name}</div>`,
                )
                .join('')}
            </div>`,
            ).join('')}
            <div class="st-playhead" style="left:8%"></div>
          </div>
        </div>
        <div class="st-props">
          <p class="st-panel-title" data-testid="st-props-title">属性 — 人声主轨</p>
          <div class="st-prop"><span>音量</span><oas-slider value="72" min="0" max="100"></oas-slider></div>
          <div class="st-prop"><span>混响</span><oas-slider value="24" min="0" max="100"></oas-slider></div>
          <div class="st-prop"><span>降噪</span><oas-switch checked></oas-switch></div>
          <div class="st-prop"><span>立体声</span><oas-switch checked></oas-switch></div>
          <p class="st-panel-title" style="margin-top:12px">选中片段</p>
          <div class="st-prop"><span data-testid="st-clip-name">主歌</span></div>
          <div class="st-prop"><span class="setting-value" data-testid="st-clip-range">0:00 → 1:02</span></div>
        </div>
      </div>
      <div class="st-transport">
        <button class="st-play" type="button" aria-label="播放">▶</button>
        <span class="st-time" data-testid="st-time">00:00</span>
        <oas-slider class="st-progress" value="8" min="0" max="100"></oas-slider>
        <span class="st-time st-dim">${fmt(total)}</span>
      </div>
    </div>`
}

/** 音轨数据：侧栏/素材库/时间轴/传输条四方联动的数据源 */
const STUDIO_TRACKS: Array<{
  name: string
  libItem: string
  duration: number
  clips: Array<{ name: string; start: number; dur: number }>
}> = [
  {
    name: '人声主轨',
    libItem: '人声主轨',
    duration: 222,
    clips: [
      { name: '主歌', start: 0, dur: 62 },
      { name: '副歌', start: 62, dur: 92 },
      { name: '尾奏', start: 154, dur: 68 },
    ],
  },
  {
    name: '和声层',
    libItem: '和声层',
    duration: 222,
    clips: [
      { name: '和声 A', start: 18, dur: 82 },
      { name: '和声 B', start: 118, dur: 84 },
    ],
  },
  {
    name: '鼓组',
    libItem: '鼓组',
    duration: 218,
    clips: [
      { name: '节拍主循环', start: 0, dur: 110 },
      { name: '过门填充', start: 110, dur: 108 },
    ],
  },
  {
    name: '采样素材',
    libItem: '采样包 A',
    duration: 222,
    clips: [
      { name: '采样包 A', start: 0, dur: 44 },
      { name: '采样包 B', start: 58, dur: 52 },
      { name: '环境铺底', start: 126, dur: 96 },
    ],
  },
]

function bindStudio(root: HTMLElement): void {
  const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const TOTAL = 222
  const applyTrack = (name: string): void => {
    const track = STUDIO_TRACKS.find((x) => x.name === name)
    if (!track) return
    const trackName = root.querySelector('.st-trackname')
    if (trackName) trackName.textContent = track.name
    const propsTitle = root.querySelector('[data-testid="st-props-title"]')
    if (propsTitle) propsTitle.textContent = `属性 — ${track.name}`
    // 侧栏与轨道 lane 选中态联动
    root.querySelectorAll<HTMLElement>('.side-item[data-track]').forEach((n) => {
      n.classList.toggle('is-active', n.dataset.track === track.name)
    })
    root.querySelectorAll<HTMLElement>('.st-lane').forEach((n) => {
      n.classList.toggle('is-active', n.dataset.track === track.name)
    })
    root.querySelectorAll<HTMLElement>('.st-lib-item').forEach((n) => {
      n.classList.toggle('is-active', (n.textContent ?? '').includes(track.libItem))
    })
  }
  // 侧栏轨道点击 → 切换音轨（徽章/lane/素材库联动）
  el(root, '[data-testid="side-panel"]').addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.side-item')
    if (item?.dataset.track) applyTrack(item.dataset.track)
  })
  // 轨道库点击：音轨项 → applyTrack；素材项 → 选中态
  const lib = root.querySelector<HTMLElement>('.st-library')
  lib?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.st-lib-item')
    if (!item) return
    const track = STUDIO_TRACKS.find((x) => x.name === item.dataset.track)
    if (track) {
      applyTrack(track.name)
    } else {
      lib.querySelectorAll<HTMLElement>('.st-lib-item').forEach((n) => {
        n.classList.toggle('is-active', n === item)
      })
      const clipName = root.querySelector('[data-testid="st-clip-name"]')
      if (clipName) clipName.textContent = `素材「${(item.textContent ?? '').trim()}」`
    }
  })
  // 时间轴 clip 点击 → 选中 + 属性面板回填起止
  const timeline = root.querySelector<HTMLElement>('.st-timeline')
  timeline?.addEventListener('click', (e) => {
    const clip = (e.target as HTMLElement).closest<HTMLElement>('.st-clip')
    if (!clip) return
    root.querySelectorAll<HTMLElement>('.st-clip').forEach((n) => {
      n.classList.toggle('is-selected', n === clip)
    })
    const clipName = root.querySelector('[data-testid="st-clip-name"]')
    if (clipName) clipName.textContent = clip.dataset.clip ?? ''
    const clipRange = root.querySelector('[data-testid="st-clip-range"]')
    if (clipRange)
      clipRange.textContent = `${fmt(Number(clip.dataset.start))} → ${fmt(Number(clip.dataset.start) + Number(clip.dataset.dur))}`
  })
  const play = root.querySelector<HTMLButtonElement>('.st-play')
  // 分享/导出按钮反馈（1.2s 后还原）
  for (const btn of root.querySelectorAll<HTMLButtonElement>('.st-toolbar oas-button')) {
    btn.addEventListener('click', () => {
      const original = btn.textContent
      btn.textContent = btn.textContent === '分享' ? '链接已复制' : '已导出 ✓'
      window.setTimeout(() => {
        btn.textContent = original
      }, 1200)
    })
  }
  const timeEl = root.querySelector('[data-testid="st-time"]')
  const progress = root.querySelector<HTMLElement>('.st-progress')
  const playhead = root.querySelector<HTMLElement>('.st-playhead')
  play?.addEventListener('click', () => {
    const playing = play.classList.toggle('is-playing')
    play.textContent = playing ? '❚❚' : '▶'
    if (!playing) return
    let sec = 17
    const timer = window.setInterval(() => {
      if (!play.classList.contains('is-playing')) {
        window.clearInterval(timer)
        return
      }
      sec = (sec + 1) % TOTAL
      if (timeEl) timeEl.textContent = fmt(sec)
      if (playhead) playhead.style.left = `${(sec / TOTAL) * 100}%`
      progress?.setAttribute('value', String(Math.round((sec / TOTAL) * 100)))
    }, 1000)
  })
}

function bindSection(root: HTMLElement, id: SectionId): void {
  if (id !== 'settings') return
  const applySkin = (skin: string): void => {
    if (skin) document.documentElement.dataset.skin = skin
    else delete document.documentElement.dataset.skin
  }
  applySkin(localStorage.getItem('oas-admin.settings.skin') ?? '')
  const glassSwitch = el<HTMLElement>(root, '#dt-glass')
  if (localStorage.getItem('oas-admin.settings.glass') === 'on')
    glassSwitch.setAttribute('checked', '')
  glassSwitch.addEventListener('oas-change', () => {
    const on = glassSwitch.hasAttribute('checked')
    if (on) document.documentElement.setAttribute('data-glass', '')
    else document.documentElement.removeAttribute('data-glass')
    localStorage.setItem('oas-admin.settings.glass', on ? 'on' : 'off')
  })
  el(root, '#dt-skin').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!chip) return
    const skin = chip.dataset.skin ?? ''
    applySkin(skin)
    if (skin) localStorage.setItem('oas-admin.settings.skin', skin)
    else localStorage.removeItem('oas-admin.settings.skin')
    el(root, '#dt-skin')
      .querySelectorAll<HTMLElement>('.chip')
      .forEach((c) => {
        c.classList.toggle('is-on', c === chip)
      })
  })
}

export function mountApp(root: HTMLElement): void {
  document.title = 'OAS Desktop'
  root.innerHTML = `
    <div class="app-frame">
      <header class="titlebar" data-testid="titlebar">
        <span class="tb-name">OAS Desktop</span>
        <span class="tb-spacer"></span>
        <span class="tb-btns">
          <button class="tb-btn" type="button" data-testid="win-min" aria-label="最小化">─</button>
          <button class="tb-btn" type="button" data-testid="win-max" aria-label="全屏">□</button>
          <button class="tb-btn tb-close" type="button" data-testid="win-close" aria-label="关闭">✕</button>
        </span>
      </header>
      <nav class="menubar" data-testid="menubar">
        ${[
          { label: '文件', id: 'file' },
          { label: '编辑', id: 'edit' },
          { label: '视图', id: 'view' },
          { label: '帮助', id: 'help' },
        ]
          .map(
            (m) =>
              `<button class="menu-item" type="button" data-menu="${m.id}">${m.label}</button>`,
          )
          .join('')}
        <span class="tb-spacer"></span>
        <button class="menu-portal" type="button" data-testid="portal-link" title="返回模板门户">返回门户</button>
      </nav>
      <div class="main">
        <aside class="activity-bar" data-testid="activity-bar">
          ${SECTIONS.map(
            (s, i) => `
          <button class="act-btn${i === 0 ? ' is-active' : ''}" type="button" data-section="${s.id}" title="${s.title}" aria-label="${s.title}">
            <oas-icon name="${s.icon}" size="20"></oas-icon>
          </button>`,
          ).join('')}
        </aside>
        <aside class="side-panel" data-testid="side-panel"></aside>
        <main class="content" data-testid="content"></main>
      </div>
      <footer class="statusbar" data-testid="statusbar">
        <span>● 就绪</span>
        <span class="sb-spacer"></span>
        <span>OAS Desktop v0.1.0</span>
        <span>·</span>
        <span>在线</span>
      </footer>
    </div>
    <oas-modal id="quit-modal" title="退出应用" no-footer>
      <div class="quit-body">
        <p>确定退出 OAS Desktop 并返回模板门户吗？</p>
        <div class="quit-actions">
          <oas-button data-testid="quit-cancel">取消</oas-button>
          <a href="/"><oas-button type="primary" data-testid="quit-ok">退出</oas-button></a>
        </div>
      </div>
    </oas-modal>`

  let current: SectionId = 'dashboard'

  function renderSide(id: SectionId): void {
    const def = SECTIONS.find((s) => s.id === id)!
    el(root, '[data-testid="side-panel"]').innerHTML = `
      <p class="side-title">${def.title}</p>
      ${def.side
        .map(
          (item, i) => `
      <button class="side-item${i === 0 ? ' is-active' : ''}" type="button"${id === 'studio' ? ` data-track="${item.label}"` : ''}>
        <span>${item.label}</span>${item.hint ? `<span class="side-hint">${item.hint}</span>` : ''}
      </button>`,
        )
        .join('')}`
  }

  function renderContent(id: SectionId): void {
    const def = SECTIONS.find((s) => s.id === id)!
    const contentEl = el(root, '[data-testid="content"]')
    // 创作台为工作站式独立布局：content 去内边距满幅铺满，滚动由内部面板接管
    if (id === 'studio') {
      contentEl.classList.add('content--flush')
      contentEl.innerHTML = studioHTML()
      bindStudio(root)
      return
    }
    contentEl.classList.remove('content--flush')
    contentEl.innerHTML = `
      <div class="content-head">
        <h1 class="content-title">${def.title}</h1>
      </div>
      <div class="content-body">${contentHTML(id)}</div>`
    bindSection(root, id)
  }

  function switchSection(id: SectionId): void {
    current = id
    el(root, '[data-testid="activity-bar"]')
      .querySelectorAll<HTMLElement>('.act-btn')
      .forEach((b) => {
        b.classList.toggle('is-active', b.dataset.section === id)
      })
    renderSide(id)
    renderContent(id)
  }

  el(root, '[data-testid="activity-bar"]').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.act-btn')
    if (!btn || btn.dataset.section === current) return
    switchSection(btn.dataset.section as SectionId)
  })

  // ── 菜单栏 ──
  const MENUS: Record<string, Array<{ label: string; act?: string }>> = {
    file: [
      { label: '导出数据', act: 'noop' },
      { label: '退出', act: 'quit' },
    ],
    edit: [{ label: '刷新页面', act: 'reload' }],
    view: [
      { label: '切换玻璃质感', act: 'glass' },
      { label: '全屏', act: 'fullscreen' },
    ],
    help: [{ label: '关于 OAS Desktop', act: 'about' }],
  }
  let openMenu: HTMLElement | null = null

  function closeMenus(): void {
    document.querySelectorAll('.menu-pop').forEach((m) => {
      m.remove()
    })
    openMenu = null
  }

  el(root, '[data-testid="menubar"]').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.menu-item')
    if (!btn) return
    const id = btn.dataset.menu ?? 'file'
    if (openMenu === btn) {
      closeMenus()
      return
    }
    closeMenus()
    openMenu = btn
    const pop = document.createElement('div')
    pop.className = 'menu-pop'
    pop.innerHTML = (MENUS[id] ?? [])
      .map(
        (item) =>
          `<button class="menu-pop-item" type="button" data-act="${item.act}">${item.label}</button>`,
      )
      .join('')
    const rect = btn.getBoundingClientRect()
    pop.style.left = `${rect.left}px`
    pop.style.top = `${rect.bottom + 2}px`
    document.body.appendChild(pop)
  })
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement
    if (!t.closest('.menu-pop') && !t.closest('.menu-item')) closeMenus()
  })
  document.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-pop-item')
    if (!item) return
    const act = item.dataset.act
    closeMenus()
    if (act === 'quit') el(root, '#quit-modal').setAttribute('visible', '')
    else if (act === 'reload') location.reload()
    else if (act === 'glass') {
      const on = document.documentElement.hasAttribute('data-glass')
      if (on) document.documentElement.removeAttribute('data-glass')
      else document.documentElement.setAttribute('data-glass', '')
      localStorage.setItem('oas-admin.settings.glass', on ? 'off' : 'on')
    } else if (act === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => {})
    } else if (act === 'about') {
      window.alert('OAS Desktop v0.1.0\noas-ui 移动/桌面体验模板家族')
    }
  })

  // ── 窗口按钮（浏览器内模拟原生行为）──
  el(root, '[data-testid="win-min"]').addEventListener('click', () => {
    const frame = el(root, '.app-frame')
    frame.classList.add('is-minimized')
    const restore = document.createElement('button')
    restore.className = 'restore-pill'
    restore.type = 'button'
    restore.textContent = 'OAS Desktop — 已最小化，点击恢复'
    restore.addEventListener('click', () => {
      frame.classList.remove('is-minimized')
      restore.remove()
    })
    document.body.appendChild(restore)
  })
  el(root, '[data-testid="win-max"]').addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  })
  el(root, '[data-testid="win-close"]').addEventListener('click', () => {
    el(root, '#quit-modal').setAttribute('visible', '')
  })
  el(root, '#quit-modal').addEventListener('click', (e) => {
    if (e.target === el(root, '#quit-modal')) el(root, '#quit-modal').removeAttribute('visible')
  })
  el(root, '[data-testid="quit-cancel"]').addEventListener('click', () => {
    el(root, '#quit-modal').removeAttribute('visible')
  })
  el(root, '[data-testid="portal-link"]').addEventListener('click', () => {
    // href=/ 由浏览器默认导航；此处仅占位保持语义
  })

  switchSection('dashboard')
}
