import '../styles/pages/settings.css'
import '@oas-ui/ui/form/color-picker'
import '@oas-ui/ui/form/slider'
import { message } from '@oas-ui/ui/feedback/message'

const FORM_MODE_KEY = 'oas-admin.form-mode'
const DENSITY_KEY = 'oas-admin.settings.table-density'
const PAGE_SIZE_KEY = 'oas-admin.settings.page-size'
const RADIUS_KEY = 'oas-admin.settings.radius'
const THEME_PREFIX = 'oas-admin.settings.theme.'
const NOTIF_PREFIX = 'oas-admin.settings.notif.'
const DEFAULT_COLOR = '#0b6cff'
const DEFAULT_RADIUS = 6

type FormMode = 'dialog' | 'drawer' | 'page'
type Density = 'compact' | 'default' | 'large'

const TABS = [
  { label: '通用', value: 'general' },
  { label: '通知', value: 'notification' },
  { label: '外观', value: 'appearance' },
]

const FORM_MODE_OPTIONS: Array<{ label: string; value: FormMode; desc: string }> = [
  { label: '对话框', value: 'dialog', desc: '弹窗居中，专注当前表单' },
  { label: '抽屉', value: 'drawer', desc: '右侧滑出，保留列表上下文' },
  { label: '新页面', value: 'page', desc: '整页表单，适合复杂录入' },
]

const DENSITY_OPTIONS: Array<{ label: string; value: Density }> = [
  { label: '紧凑', value: 'compact' },
  { label: '适中', value: 'default' },
  { label: '宽松', value: 'large' },
]

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50].map((n) => ({ label: `${n} 条`, value: String(n) }))

const NOTIF_ROWS = [
  { key: 'orders', label: '订单' },
  { key: 'inventory', label: '库存' },
  { key: 'system', label: '系统' },
]
const NOTIF_CHANNELS = [
  { key: 'inapp', label: '站内' },
  { key: 'email', label: '邮件' },
]

function readFormMode(): FormMode {
  const v = localStorage.getItem(FORM_MODE_KEY)
  return v === 'dialog' || v === 'page' ? v : 'drawer'
}

function readDensity(): Density {
  const v = localStorage.getItem(DENSITY_KEY)
  return v === 'compact' || v === 'large' ? v : 'default'
}

function readPageSize(): string {
  return localStorage.getItem(PAGE_SIZE_KEY) ?? '5'
}

function readRadius(): number {
  const n = Number(localStorage.getItem(RADIUS_KEY))
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RADIUS
}

function readBool(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key)
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function readColor(): string {
  const stored = localStorage.getItem(`${THEME_PREFIX}${currentTheme()}`)
  if (stored) return stored
  const live = getComputedStyle(document.documentElement)
    .getPropertyValue('--oas-color-primary')
    .trim()
  return live || DEFAULT_COLOR
}

const DENSITY_PAD: Record<Density, string> = { compact: '6px', default: '12px', large: '16px' }

function applyDensity(): void {
  document.documentElement.style.setProperty('--oas-table-cell-padding-block', DENSITY_PAD[readDensity()])
}

export function applySettings(): void {
  const theme = currentTheme()
  const color = localStorage.getItem(`${THEME_PREFIX}${theme}`)
  if (color) document.documentElement.style.setProperty('--oas-color-primary', color)
  const radius = localStorage.getItem(RADIUS_KEY)
  if (radius) document.documentElement.style.setProperty('--oas-radius-md', `${radius}px`)
  applyDensity()
}

export function render(el: HTMLElement): () => void {
  const tabs = document.createElement('oas-tabs')
  tabs.setAttribute('data-testid', 'settings-tabs')
  tabs.setAttribute('id', 'settings-tabs')

  function panel(value: string): { node: HTMLDivElement; set: (html: string) => void } {
    const node = document.createElement('div')
    node.className = 'settings-panel'
    node.dataset.panel = value
    return {
      node,
      set: (html: string) => {
        node.innerHTML = html
      },
    }
  }

  const general = panel('general')
  const notification = panel('notification')
  const appearance = panel('appearance')
  notification.node.hidden = true
  appearance.node.hidden = true

  el.innerHTML = `
    <div class="page settings-page">
      <div class="page-head">
        <div>
          <h1 class="page-title">设置中心</h1>
          <p class="page-subtitle">管理表单、通知与界面外观偏好</p>
        </div>
      </div>
      <oas-card class="settings-card" title="偏好设置"></oas-card>
    </div>`

  const card = el.querySelector<HTMLElement>('.settings-card')!
  card.appendChild(tabs)
  card.appendChild(general.node)
  card.appendChild(notification.node)
  card.appendChild(appearance.node)
  tabs.innerHTML = TABS.map(
    (t) => `<oas-tab-panel label="${t.label}" value="${t.value}"></oas-tab-panel>`,
  ).join('')
  tabs.setAttribute('active', 'general')

  function switchPanel(value: string): void {
    ;[general, notification, appearance].forEach((p) => {
      p.node.hidden = p.node.dataset.panel !== value
    })
    tabs.setAttribute('active', value)
  }

  general.set(`
    <div class="setting-group">
      <div class="setting-group-title">表单呈现方式</div>
      <div class="form-hint">作用于商品等需要录入的表单</div>
      <div class="radio-group" data-testid="form-mode-group" id="form-mode-group">
        ${FORM_MODE_OPTIONS.map(
          (o) =>
            `<oas-radio name="formMode" value="${o.value}"${readFormMode() === o.value ? ' checked' : ''}><span class="radio-item"><span class="radio-label">${o.label}</span><span class="radio-desc">${o.desc}</span></span></oas-radio>`,
        ).join('')}
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-group-title">表格密度</div>
      <div class="radio-group inline" data-testid="density-group" id="density-group">
        ${DENSITY_OPTIONS.map(
          (o) =>
            `<oas-radio name="density" value="${o.value}"${readDensity() === o.value ? ' checked' : ''}>${o.label}</oas-radio>`,
        ).join('')}
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-row">
        <div>
          <div class="setting-label">每页条数</div>
          <div class="setting-hint">列表视图每页显示行数</div>
        </div>
        <oas-select data-testid="page-size" options='${JSON.stringify(PAGE_SIZE_OPTIONS)}' value="${readPageSize()}"></oas-select>
      </div>
    </div>`)

  notification.set(`
    <div class="setting-group">
      <div class="setting-group-title">通知偏好</div>
      <div class="notif-matrix" data-testid="notif-matrix" id="notif-matrix">
        <div class="notif-row notif-head">
          <span>通知类型</span>
          ${NOTIF_CHANNELS.map((c) => `<span class="notif-col">${c.label}</span>`).join('')}
        </div>
        ${NOTIF_ROWS.map(
          (row) => `
          <div class="notif-row">
            <span class="notif-channel">${row.label}</span>
            ${NOTIF_CHANNELS.map(
              (c) =>
                `<span class="notif-col"><oas-switch data-testid="notif-${row.key}-${c.key}" data-key="${row.key}.${c.key}"${readBool(NOTIF_PREFIX + row.key + '.' + c.key, true) ? ' checked' : ''}></oas-switch></span>`,
            ).join('')}
          </div>`,
        ).join('')}
      </div>
    </div>`)

  appearance.set(`
    <div class="setting-group">
      <div class="setting-group-title">主题色</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">品牌主色</div>
          <div class="setting-hint">即时应用，明暗主题各自独立保存</div>
        </div>
        <oas-color-picker data-testid="appearance-color" id="appearance-color" value="${readColor()}"></oas-color-picker>
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-group-title">圆角</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">控件圆角</div>
          <div class="setting-hint">1 ~ 12px</div>
        </div>
        <div class="radius-control">
          <oas-slider data-testid="appearance-radius" id="appearance-radius" min="1" max="12" step="1" value="${readRadius()}"></oas-slider>
          <span id="radius-value" class="mono">${readRadius()}px</span>
        </div>
      </div>
    </div>
    <div class="setting-group">
      <oas-button data-testid="appearance-reset" type="default">恢复默认</oas-button>
    </div>`)

  const formModeGroup = general.node.querySelector<HTMLElement>('#form-mode-group')!
  const densityGroup = general.node.querySelector<HTMLElement>('#density-group')!
  const pageSize = general.node.querySelector<HTMLElement>('[data-testid="page-size"]')!
  const notifMatrix = notification.node.querySelector<HTMLElement>('#notif-matrix')!
  const colorPicker = appearance.node.querySelector<HTMLElement>('#appearance-color')!
  const radiusSlider = appearance.node.querySelector<HTMLElement>('#appearance-radius')!
  const radiusValue = appearance.node.querySelector<HTMLElement>('#radius-value')!
  const resetBtn = appearance.node.querySelector<HTMLElement>('[data-testid="appearance-reset"]')!

  formModeGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0] as HTMLElement
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value') as FormMode
    if (!v) return
    localStorage.setItem(FORM_MODE_KEY, v)
    message.success('已保存')
  })

  densityGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0] as HTMLElement
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value')
    if (!v) return
    localStorage.setItem(DENSITY_KEY, v)
    applyDensity()
    message.success('已保存')
  })

  pageSize.addEventListener('oas-change', (e) => {
    const v = (e as CustomEvent<{ value: string }>).detail.value
    if (!v) return
    localStorage.setItem(PAGE_SIZE_KEY, v)
    message.success('已保存')
  })

  notifMatrix.addEventListener('oas-change', (e) => {
    const sw = e.composedPath()[0] as HTMLElement
    const key = sw.getAttribute('data-key')
    if (!key) return
    const checked = (e as CustomEvent<{ checked: boolean }>).detail.checked
    localStorage.setItem(NOTIF_PREFIX + key, String(checked))
  })

  function applyColor(color: string): void {
    document.documentElement.style.setProperty('--oas-color-primary', color)
    localStorage.setItem(`${THEME_PREFIX}${currentTheme()}`, color)
  }

  colorPicker.addEventListener('oas-change', (e) => {
    const color = (e as CustomEvent<{ value: string }>).detail.value
    if (!color) return
    applyColor(color)
  })

  radiusSlider.addEventListener('oas-change', (e) => {
    const value = (e as CustomEvent<{ value: number }>).detail.value
    const n = Number(value)
    if (!Number.isFinite(n)) return
    document.documentElement.style.setProperty('--oas-radius-md', `${n}px`)
    localStorage.setItem(RADIUS_KEY, String(n))
    radiusValue.textContent = `${n}px`
  })

  resetBtn.addEventListener('click', () => {
    localStorage.removeItem(`${THEME_PREFIX}light`)
    localStorage.removeItem(`${THEME_PREFIX}dark`)
    localStorage.removeItem(RADIUS_KEY)
    document.documentElement.style.removeProperty('--oas-color-primary')
    document.documentElement.style.removeProperty('--oas-radius-md')
    colorPicker.setAttribute('value', DEFAULT_COLOR)
    radiusSlider.setAttribute('value', String(DEFAULT_RADIUS))
    radiusValue.textContent = `${DEFAULT_RADIUS}px`
    message.success('已恢复默认')
  })

  const onThemeChange = (): void => {
    const theme = currentTheme()
    const cp = appearance.node.querySelector<HTMLElement>('#appearance-color')!
    cp.setAttribute('value', readColor())
    const stored = localStorage.getItem(`${THEME_PREFIX}${theme}`)
    if (stored) document.documentElement.style.setProperty('--oas-color-primary', stored)
    else document.documentElement.style.removeProperty('--oas-color-primary')
  }

  tabs.addEventListener('oas-change', (e) => {
    switchPanel((e as CustomEvent<{ value: string }>).detail.value)
  })

  document.addEventListener('themechange', onThemeChange)
  switchPanel('general')

  return () => {
    document.removeEventListener('themechange', onThemeChange)
  }
}
