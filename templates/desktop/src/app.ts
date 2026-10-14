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
    icon: 'edit',
    side: [
      { label: '视频', hint: '3' },
      { label: '音频', hint: '2' },
      { label: '文字', hint: '1' },
      { label: '贴纸', hint: '1' },
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

/** 各板块当前选中的侧栏二级项（驱动侧栏高亮与内容区子视图） */
const SUB_STATE: Record<string, string> = {
  dashboard: '经营总览',
  orders: '全部订单',
  users: '全部用户',
  settings: '外观',
  studio: '视频',
}

function contentHTML(id: SectionId, sub: string): string {
  if (id === 'dashboard') {
    if (sub === '访问趋势') {
      return `
        <div class="panel">
          <p class="panel-title">近 30 日访问趋势</p>
          <oas-chart id="sub-chart" type="area" options='{"smooth":true,"gradient":true}'></oas-chart>
        </div>`
    }
    if (sub === '转化漏斗') {
      return `
        <div class="panel">
          <p class="panel-title">转化漏斗（近 30 日）</p>
          <div class="funnel-row"><span class="funnel-label">访问</span><div class="funnel-bar" style="width:100%">12,480</div></div>
          <div class="funnel-row"><span class="funnel-label">注册</span><div class="funnel-bar" style="width:32%">861</div></div>
          <div class="funnel-row"><span class="funnel-label">付费</span><div class="funnel-bar" style="width:12%">88</div></div>
        </div>`
    }
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
    const rows = sub === '全部订单' ? ORDERS : ORDERS.filter((o) => o.status === sub)
    return `
      <div class="toolbar"><oas-input placeholder="搜索订单号 / 客户" prefix-icon="search" clearable></oas-input><oas-button type="primary" size="small">导出</oas-button></div>
      <div class="panel">
        <div class="thead"><span>订单号</span><span>客户</span><span>金额</span><span>状态</span></div>
        ${rows
          .map(
            (o) =>
              `<div class="trow"><span>${o.no}</span><span>${o.customer}</span><span>${o.amount}</span><oas-tag size="small" type="${o.ok ? 'success' : 'warning'}">${o.status}</oas-tag></div>`,
          )
          .join('')}
        ${rows.length === 0 ? '<oas-empty description="该状态下暂无订单"></oas-empty>' : ''}
      </div>`
  }
  if (id === 'users') {
    const rows = USERS.filter((u) =>
      sub === '全部用户' ? true : sub === '已停用' ? !u.on : u.dept === sub,
    )
    return `
      <div class="toolbar"><oas-input placeholder="搜索用户" prefix-icon="search" clearable></oas-input><oas-button type="primary" size="small">新建用户</oas-button></div>
      <div class="panel">
        <div class="thead"><span>用户</span><span>角色</span><span>部门</span><span>启用</span></div>
        ${rows
          .map(
            (u) =>
              `<div class="trow"><span>${u.name}</span><oas-tag size="small">${u.role}</oas-tag><span>${u.dept}</span><oas-switch ${u.on ? 'checked' : ''}></oas-switch></div>`,
          )
          .join('')}
        ${rows.length === 0 ? '<oas-empty description="该分组暂无用户"></oas-empty>' : ''}
      </div>`
  }
  const skin = localStorage.getItem('oas-admin.settings.skin') ?? ''
  const glassOn = localStorage.getItem('oas-admin.settings.glass') === 'on'
  if (sub === '通知') {
    return `
      <div class="panel settings-panel">
        <p class="panel-title">通知与展示</p>
        <div class="setting-item"><span>消息通知</span><oas-switch checked></oas-switch></div>
        <div class="setting-item"><span>字号</span><span class="setting-value">标准</span></div>
        <div class="setting-item"><span>清除缓存</span><span class="setting-value">2.1 MB</span></div>
      </div>`
  }
  if (sub === '关于') {
    return `
      <div class="panel settings-panel">
        <p class="panel-title">关于</p>
        <div class="setting-item"><span>应用</span><span class="setting-value">OAS Desktop v0.1.0</span></div>
        <div class="setting-item"><span>组件库</span><span class="setting-value">oas-ui 2.6.0</span></div>
      </div>`
  }
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

// ── 创作台（视频剪辑，剪映范式）：媒体库 | 预览播放器 | 属性检查器 + 多轨时间轴 ──
interface StudioClip {
  id: number
  name: string
  track: string
  start: number
  dur: number
}

interface MediaItem {
  name: string
  kind: '视频' | '音频' | '文字' | '贴纸'
  dur: number
}

const STUDIO_TRACKS = ['视频主轨', '贴纸轨', '文字轨', '音频轨'] as const

const KIND_ACCENT: Record<string, string> = {
  视频主轨: 'linear-gradient(135deg, #4f6bff 0%, #38bdf8 100%)',
  贴纸轨: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)',
  文字轨: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  音频轨: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
}

const MEDIA_LIBRARY: MediaItem[] = [
  { name: '城市航拍 4K', kind: '视频', dur: 32 },
  { name: '日落延时', kind: '视频', dur: 18 },
  { name: '人物特写', kind: '视频', dur: 24 },
  { name: '旁白配音', kind: '音频', dur: 60 },
  { name: 'BGM 轻快', kind: '音频', dur: 90 },
  { name: '标题字幕', kind: '文字', dur: 8 },
  { name: '点赞贴纸', kind: '贴纸', dur: 5 },
]

const STUDIO_TOTAL = 50

let studioClips: StudioClip[] = [
  { id: 1, name: '城市航拍 4K', track: '视频主轨', start: 0, dur: 32 },
  { id: 2, name: '日落延时', track: '视频主轨', start: 32, dur: 18 },
  { id: 3, name: '标题字幕', track: '文字轨', start: 2, dur: 8 },
  { id: 4, name: '点赞贴纸', track: '贴纸轨', start: 10, dur: 5 },
  { id: 5, name: 'BGM 轻快', track: '音频轨', start: 0, dur: 50 },
]
let studioSeq = 6

function trackEnd(track: string): number {
  return studioClips
    .filter((c) => c.track === track)
    .reduce((max, c) => Math.max(max, c.start + c.dur), 0)
}

function videoEditorHTML(): string {
  return `
    <div class="studio" data-testid="studio">
      <div class="st-toolbar">
        <span class="st-project">未命名项目 · v1</span>
        <span class="tb-spacer"></span>
        <oas-button size="small">分享</oas-button>
        <oas-button size="small" type="primary">导出</oas-button>
      </div>
      <div class="st-top">
        <div class="st-library" data-testid="st-library">
          <p class="st-panel-title">媒体库</p>
          <div id="st-lib-list"></div>
        </div>
        <div class="st-preview-wrap">
          <div class="st-preview" data-testid="st-preview">
            <div class="st-screen" id="st-screen">
              <span class="st-screen-name" id="st-screen-name">黑场</span>
            </div>
            <div class="st-transport">
              <button class="st-tbtn" id="st-home" aria-label="回到开头">⏮</button>
              <button class="st-play" id="st-play" type="button" aria-label="播放">▶</button>
              <span class="st-time" data-testid="st-time">0:00</span>
              <oas-slider class="st-progress" id="st-progress" value="0" min="0" max="100"></oas-slider>
              <span class="st-time st-dim">0:50</span>
            </div>
          </div>
        </div>
        <div class="st-props">
          <p class="st-panel-title" data-testid="st-props-title">属性 — 未选中</p>
          <div class="st-prop"><span>名称</span><span class="setting-value" data-testid="st-clip-name">—</span></div>
          <div class="st-prop"><span>轨道</span><span class="setting-value" data-testid="st-clip-track">—</span></div>
          <div class="st-prop"><span>起止</span><span class="setting-value" data-testid="st-clip-range">—</span></div>
          <div class="st-prop"><span>音量</span><oas-slider value="80" min="0" max="100"></oas-slider></div>
          <div class="st-prop"><span>不透明度</span><oas-slider value="100" min="0" max="100"></oas-slider></div>
        </div>
      </div>
      <div class="st-timeline-wrap" data-testid="st-timeline">
        <div class="st-tl-toolbar">
          <span class="st-zoom-label">显示比例</span>
          <button class="st-tbtn" id="st-zoom-out" type="button" aria-label="缩小">−</button>
          <button class="st-tbtn" id="st-zoom-fit" type="button">适应</button>
          <button class="st-tbtn" id="st-zoom-in" type="button" aria-label="放大">＋</button>
          <span class="tb-spacer"></span>
          <button class="st-tbtn" id="st-split" type="button">✂ 分割</button>
        </div>
        <div class="st-timeline">
          <div class="st-inner" id="st-inner">
            <div class="st-corner"></div>
            <div class="st-ruler" id="st-ruler"></div>
            <div class="st-lane-row" data-testid="st-lane" data-track="视频主轨">
              <div class="st-trackhead">视频主轨</div>
              <div class="st-lane"></div>
            </div>
            <div class="st-lane-row" data-track="贴纸轨">
              <div class="st-trackhead">贴纸轨</div>
              <div class="st-lane"></div>
            </div>
            <div class="st-lane-row" data-track="文字轨">
              <div class="st-trackhead">文字轨</div>
              <div class="st-lane"></div>
            </div>
            <div class="st-lane-row" data-track="音频轨">
              <div class="st-trackhead">音频轨<button class="st-mute" type="button" data-track="音频轨" aria-label="静音">M</button></div>
              <div class="st-lane"></div>
            </div>
            <div class="st-playhead" id="st-playhead" style="left:90px"></div>
          </div>
        </div>
      </div>    </div>`
}

function bindSection(root: HTMLElement, id: SectionId): void {
  if (id !== 'settings') return
  const applySkin = (skin: string): void => {
    if (skin) document.documentElement.dataset.skin = skin
    else delete document.documentElement.dataset.skin
  }
  applySkin(localStorage.getItem('oas-admin.settings.skin') ?? '')
  // 通知/关于子面板无外观控件（按 sub 渲染的 panel 可能不含 #dt-glass）
  const glassSwitch = root.querySelector<HTMLElement>('#dt-glass')
  if (!glassSwitch) return
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
      .forEach((x) => {
        x.classList.toggle('is-on', x === chip)
      })
  })
}

function bindVideoEditor(root: HTMLElement): void {
  const fmt = (s: number): string =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const HEADER = 90
  let pxPerSec = 24
  let libFilter = '全部'
  let selectedId: number | null = null
  let time = 0
  let playing = false
  let timer: number | undefined
  const muted: Record<string, boolean> = {}

  const libList = el(root, '#st-lib-list')
  const screen = el(root, '#st-screen')
  const screenName = el(root, '#st-screen-name')
  const timeEl = el(root, '[data-testid="st-time"]')
  const progress = el(root, '#st-progress')
  const playhead = el(root, '#st-playhead')
  const play = el<HTMLButtonElement>(root, '#st-play')
  const timelineEl = el<HTMLElement>(root, '[data-testid="st-timeline"]')

  const px = (sec: number): number => Math.round(sec * pxPerSec)

  function renderLibrary(): void {
    const rows = MEDIA_LIBRARY.filter((m) => libFilter === '全部' || m.kind === libFilter)
    libList.innerHTML = rows
      .map(
        (m) => `
      <button class="st-lib-item" type="button" data-name="${m.name}" data-kind="${m.kind}" data-dur="${m.dur}">
        <oas-icon name="star" size="13"></oas-icon>
        <span class="st-lib-name">${m.name}</span>
        <span class="st-lib-dur">${m.kind} · ${m.dur}s</span>
      </button>`,
      )
      .join('')
  }

  function neighbors(track: string, id: number): { prevEnd: number; nextStart: number } {
    const me = studioClips.find((c) => c.id === id)!
    const same = studioClips
      .filter((c) => c.track === track && c.id !== id)
      .sort((a, b) => a.start - b.start)
    let prevEnd = 0
    let nextStart = STUDIO_TOTAL
    for (const c of same) {
      if (c.start + c.dur <= me.start) prevEnd = Math.max(prevEnd, c.start + c.dur)
      if (c.start >= me.start) nextStart = Math.min(nextStart, c.start)
    }
    return { prevEnd, nextStart }
  }

  function renderTimeline(): void {
    const width = px(STUDIO_TOTAL)
    const ruler = el(root, '#st-ruler')
    const marks = [0, 10, 20, 30, 40, 50]
    ruler.style.width = `${width}px`
    ruler.innerHTML = marks
      .map((s) => `<span class="st-mark" style="left:${px(s)}px">${fmt(s)}</span>`)
      .join('')
    for (const track of STUDIO_TRACKS) {
      const lane = el<HTMLElement>(root, `.st-lane-row[data-track="${track}"] .st-lane`)
      lane.style.width = `${width}px`
      lane.querySelectorAll('.st-clip').forEach((n) => {
        n.remove()
      })
      for (const c of studioClips.filter((x) => x.track === track)) {
        const clip = document.createElement('div')
        clip.className = 'st-clip'
        clip.dataset.clipId = String(c.id)
        clip.dataset.clip = c.name
        clip.dataset.track = track
        clip.dataset.start = String(c.start)
        clip.dataset.dur = String(c.dur)
        clip.style.left = `${px(c.start)}px`
        clip.style.width = `${Math.max(8, px(c.dur) - 2)}px`
        clip.style.background = KIND_ACCENT[track]
        clip.textContent = c.name
        lane.appendChild(clip)
      }
    }
    playhead.style.left = `${HEADER + px(time)}px`
  }

  function zoom(factor: number | 'fit'): void {
    const fitPx = (timelineEl.clientWidth - HEADER - 8) / STUDIO_TOTAL
    pxPerSec = factor === 'fit' ? fitPx : Math.min(120, Math.max(6, Math.round(pxPerSec * factor)))
    renderTimeline()
  }

  function selectClip(id: number | null): void {
    selectedId = id
    root.querySelectorAll<HTMLElement>('.st-clip').forEach((n) => {
      n.classList.toggle('is-selected', Number(n.dataset.clipId) === id)
    })
    const clip = studioClips.find((x) => x.id === id)
    const title = el(root, '[data-testid="st-props-title"]')
    const nameEl = el(root, '[data-testid="st-clip-name"]')
    const trackEl = el(root, '[data-testid="st-clip-track"]')
    const rangeEl = el(root, '[data-testid="st-clip-range"]')
    if (!clip) {
      title.textContent = '属性 — 未选中'
      nameEl.textContent = '—'
      trackEl.textContent = '—'
      rangeEl.textContent = '—'
      return
    }
    title.textContent = '属性 — 已选中'
    nameEl.textContent = clip.name
    trackEl.textContent = clip.track
    rangeEl.textContent = `${fmt(clip.start)} → ${fmt(clip.start + clip.dur)}`
  }

  function renderPreview(): void {
    const mainTrack = STUDIO_TRACKS[0]
    const mainMuted = muted[mainTrack] === true
    const hit =
      studioClips.find(
        (x) => x.track === mainTrack && !mainMuted && time >= x.start && time < x.start + x.dur,
      ) ?? null
    const hues: Record<string, string> = {
      '城市航拍 4K': 'linear-gradient(135deg,#0ea5e9,#6366f1)',
      日落延时: 'linear-gradient(135deg,#f59e0b,#ef4444)',
      人物特写: 'linear-gradient(135deg,#10b981,#0ea5e9)',
    }
    if (hit) {
      screenName.textContent = hit.name
      screen.style.background = hues[hit.name] ?? 'linear-gradient(135deg,#334155,#0f172a)'
    } else {
      screenName.textContent = '黑场'
      screen.style.background = '#0b0e14'
    }
  }

  function renderTransport(): void {
    timeEl.textContent = fmt(time)
    progress.setAttribute('value', String(Math.round((time / STUDIO_TOTAL) * 100)))
    playhead.style.left = `${HEADER + px(time)}px`
    renderPreview()
  }

  function tick(): void {
    if (!playing) return
    time = (time + 0.25) % STUDIO_TOTAL
    renderTransport()
  }

  // ── 素材点击 → 添加到对应轨道末尾 ──
  libList.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.st-lib-item')
    if (!item) return
    const name = item.dataset.name!
    const kind = item.dataset.kind as MediaItem['kind']
    const dur = Number(item.dataset.dur)
    const track =
      kind === '视频'
        ? '视频主轨'
        : kind === '音频'
          ? '音频轨'
          : kind === '文字'
            ? '文字轨'
            : '贴纸轨'
    studioClips.push({ id: studioSeq++, name, track, start: trackEnd(track), dur })
    renderTimeline()
    selectClip(studioSeq - 1)
  })

  // ── 时间轴交互（委托）：clip 拖动/边缘裁剪 + 点击选中 ──
  let drag: {
    id: number
    mode: 'move' | 'trim-left' | 'trim-right'
    originX: number
    origStart: number
    origDur: number
  } | null = null

  timelineEl.addEventListener('pointerdown', (e) => {
    const clipEl = (e.target as HTMLElement).closest<HTMLElement>('.st-clip')
    if (!clipEl) return
    const id = Number(clipEl.dataset.clipId)
    const clip = studioClips.find((c) => c.id === id)
    if (!clip) return
    selectClip(id)
    const rect = clipEl.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const mode = offsetX <= 6 ? 'trim-left' : offsetX >= rect.width - 6 ? 'trim-right' : 'move'
    drag = { id, mode, originX: e.clientX, origStart: clip.start, origDur: clip.dur }
    const { prevEnd, nextStart } = neighbors(clip.track, id)
    const move = (ev: PointerEvent): void => {
      const dt = (ev.clientX - drag!.originX) / pxPerSec
      const c = studioClips.find((x) => x.id === drag!.id)
      if (!c) return
      if (drag!.mode === 'move') {
        c.start = Math.min(Math.max(drag!.origStart + dt, prevEnd), nextStart - c.dur)
      } else if (drag!.mode === 'trim-left') {
        const ns = Math.min(
          Math.max(drag!.origStart + dt, prevEnd),
          drag!.origStart + drag!.origDur - 1,
        )
        c.dur = drag!.origDur + (drag!.origStart - ns)
        c.start = ns
      } else {
        const ne = Math.min(
          Math.max(drag!.origStart + drag!.origDur + dt, drag!.origStart + 1),
          nextStart,
        )
        c.dur = ne - drag!.origStart
      }
      renderTimeline()
      selectClip(c.id)
    }
    const up = (): void => {
      drag = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })

  timelineEl.addEventListener('click', (e) => {
    const clipEl = (e.target as HTMLElement).closest<HTMLElement>('.st-clip')
    if (clipEl) selectClip(Number(clipEl.dataset.clipId))
    else selectClip(null)
  })

  // ── 键盘快捷键 ──
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement
    if (t?.closest('input, textarea, [contenteditable="true"]')) return
    // Ctrl+1~5 切换板块
    if ((e.ctrlKey || e.metaKey) && /^[1-5]$/.test(e.key)) {
      e.preventDefault()
      const idx = Number(e.key) - 1
      if (idx < SECTIONS.length) switchSection(SECTIONS[idx].id)
      return
    }
    // Ctrl+W 关闭当前 tab
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
      e.preventDefault()
      closeTab(current)
      return
    }
    // 创作台：空格播放 / Delete 删除选中 clip
    if (current === 'studio') {
      if (e.code === 'Space') {
        e.preventDefault()
        play.click()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId !== null) {
        e.preventDefault()
        studioClips = studioClips.filter((c) => c.id !== selectedId)
        renderTimeline()
        selectClip(null)
        renderPreview()
      }
    }
  })

  // ── 分割：选中 clip 在播放头处切开 ──
  el(root, '#st-split').addEventListener('click', () => {
    const clip = studioClips.find((c) => c.id === selectedId)
    if (!clip || time <= clip.start || time >= clip.start + clip.dur) return
    const leftDur = time - clip.start
    const right: StudioClip = {
      id: studioSeq++,
      name: clip.name,
      track: clip.track,
      start: time,
      dur: clip.dur - leftDur,
    }
    clip.dur = leftDur
    studioClips.push(right)
    renderTimeline()
    selectClip(right.id)
  })

  // ── 播放/暂停（空格同款）──
  play.addEventListener('click', () => {
    playing = !playing
    play.textContent = playing ? '❚❚' : '▶'
    if (playing) timer = window.setInterval(tick, 250)
    else if (timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
  })

  // ── 缩放 ──
  el(root, '#st-zoom-in').addEventListener('click', () => zoom(1.3))
  el(root, '#st-zoom-out').addEventListener('click', () => zoom(1 / 1.3))
  el(root, '#st-zoom-fit').addEventListener('click', () => zoom('fit'))

  // ── 静音 ──
  timelineEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.st-mute')
    if (!btn) return
    const track = btn.dataset.track!
    muted[track] = !muted[track]
    btn.classList.toggle('is-on', muted[track])
    const lane = el<HTMLElement>(root, `.st-lane-row[data-track="${track}"] .st-lane`)
    lane.classList.toggle('is-muted', muted[track])
    renderPreview()
  })

  // ── 回开头 ──
  el(root, '#st-home').addEventListener('click', () => {
    time = 0
    renderTransport()
  })
  progress.addEventListener('oas-input', (e) => {
    const v = Number((e as CustomEvent<{ value: number }>).detail.value)
    if (Number.isFinite(v)) {
      time = (v / 100) * STUDIO_TOTAL
      renderTransport()
    }
  })

  // ── 媒体分类联动 ──
  document.addEventListener('st-cat', (e) => {
    libFilter = (e as CustomEvent<string>).detail ?? '全部'
    renderLibrary()
  })

  zoom('fit')
  renderLibrary()
  renderTransport()
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
        <main class="content" data-testid="content">
          <div class="content-tabs" data-testid="content-tabs"></div>
          <div class="content-page" data-testid="content-page"></div>
        </main>
      </div>
      <footer class="statusbar" data-testid="statusbar">
        <span>● 就绪</span>
        <span class="sb-spacer"></span>
        <span>OAS Desktop v0.1.0</span>
        <span>·</span>
        <span>在线</span>
      </footer>
    </div>
    <oas-modal id="about-modal" title="关于" no-footer>
      <div class="about-body">
        <span class="about-logo">OAS</span>
        <p class="about-name">OAS Desktop</p>
        <p class="about-ver">v0.1.0 · oas-ui 2.6.0</p>
        <p class="about-desc">oas-ui 桌面软件体验模板——自绘标题栏、菜单栏、活动栏、多轨时间轴创作台。</p>
        <div class="quit-actions">
          <oas-button type="primary" data-testid="about-close">知道了</oas-button>
        </div>
      </div>
    </oas-modal>
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
    const active = SUB_STATE[id] ?? def.side[0].label
    el(root, '[data-testid="side-panel"]').innerHTML = `
      <p class="side-title">${def.title}</p>
      ${def.side
        .map(
          (item) => `
      <button class="side-item${item.label === active ? ' is-active' : ''}" type="button"${id === 'studio' ? ` data-cat="${item.label}"` : ` data-sub="${item.label}"`}>
        <span>${item.label}</span>${item.hint ? `<span class="side-hint">${item.hint}</span>` : ''}
      </button>`,
        )
        .join('')}`
  }

  // ── 多标签内容区 ──
  const openTabs: SectionId[] = ['dashboard']

  function renderTabs(): void {
    const strip = el(root, '[data-testid="content-tabs"]')
    strip.innerHTML = openTabs
      .map((id) => {
        const def = SECTIONS.find((s) => s.id === id)!
        const isActive = SUB_STATE[id] !== undefined && id === current
        const closable = id !== 'dashboard'
        return `
        <button class="ctab${isActive ? ' is-active' : ''}" type="button" data-tab="${id}">
          <span>${def.title}</span>${closable ? `<span class="ctab-close" data-close="${id}">✕</span>` : ''}
        </button>`
      })
      .join('')
  }

  function openTab(id: SectionId): void {
    if (!openTabs.includes(id)) openTabs.push(id)
    renderTabs()
  }

  function closeTab(id: SectionId): void {
    const idx = openTabs.indexOf(id)
    if (idx < 0 || id === 'dashboard') return
    openTabs.splice(idx, 1)
    if (activeTab === id) {
      const next = openTabs[Math.min(idx, openTabs.length - 1)] ?? 'dashboard'
      switchSection(next)
    }
    renderTabs()
  }

  el(root, '[data-testid="content-tabs"]').addEventListener('click', (e) => {
    const closeBtn = (e.target as HTMLElement).closest<HTMLElement>('.ctab-close')
    if (closeBtn) {
      e.stopPropagation()
      closeTab(closeBtn.dataset.close as SectionId)
      return
    }
    const tab = (e.target as HTMLElement).closest<HTMLElement>('.ctab')
    if (tab?.dataset.tab && tab.dataset.tab !== current) switchSection(tab.dataset.tab as SectionId)
  })

  function renderContent(id: SectionId): void {
    const def = SECTIONS.find((s) => s.id === id)!
    openTab(id)
    renderTabs()
    const contentEl = el(root, '[data-testid="content"]')
    const pageEl = el(root, '[data-testid="content-page"]')
    // 创作台为工作站式独立布局：content 去内边距满幅铺满，滚动由内部面板接管
    if (id === 'studio') {
      contentEl.classList.add('content--flush')
      pageEl.innerHTML = videoEditorHTML()
      bindVideoEditor(root)
      return
    }
    contentEl.classList.remove('content--flush')
    const sub = SUB_STATE[id] ?? def.side[0].label
    pageEl.innerHTML = `
      <div class="content-head">
        <h1 class="content-title">${def.title}<oas-tag size="small" style="margin-left:10px">${sub}</oas-tag></h1>
      </div>
      <div class="content-body">${contentHTML(id, sub)}</div>`
    bindSection(root, id)
    if (id === 'dashboard' && sub === '访问趋势') {
      const chart = pageEl.querySelector('#sub-chart')
      if (chart)
        (chart as unknown as { data: unknown }).data = {
          labels: ['10-08', '10-09', '10-10', '10-11', '10-12', '10-13', '10-14'],
          series: [
            { name: '访问量', data: [820, 932, 901, 1090, 1290, 1130, 1248] },
            { name: '独立访客', data: [620, 710, 690, 810, 952, 880, 964] },
          ],
        }
    }
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

  // 创作台：侧栏媒体分类 → 媒体库过滤（经自定义事件跨到编辑器作用域）
  el(root, '[data-testid="side-panel"]').addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.side-item')
    if (!item) return
    if (current === 'studio') {
      if (!item.dataset.cat) return
      el(root, '[data-testid="side-panel"]')
        .querySelectorAll<HTMLElement>('.side-item')
        .forEach((n) => {
          n.classList.toggle('is-active', n === item)
        })
      document.dispatchEvent(new CustomEvent('st-cat', { detail: item.dataset.cat }))
      return
    }
    // 其余板块：二级菜单切换内容子视图
    if (!item.dataset.sub || SUB_STATE[current] === item.dataset.sub) return
    SUB_STATE[current] = item.dataset.sub
    renderSide(current)
    renderContent(current)
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
      el(root, '#about-modal').setAttribute('visible', '')
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
  const aboutModal = el<HTMLElement>(root, '#about-modal')
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.removeAttribute('visible')
  })
  aboutModal.querySelector('[data-testid="about-close"]')?.addEventListener('click', () => {
    aboutModal.removeAttribute('visible')
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
