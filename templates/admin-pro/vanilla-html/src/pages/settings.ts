import '../styles/pages/settings.css'
import '@oas-ui/ui/form/color-picker'
import '@oas-ui/ui/form/slider'
import { message } from '@oas-ui/ui/feedback/message'
import { t } from '../i18n'
import {
  DEFAULT_COLOR,
  DEFAULT_RADIUS,
  DENSITY_KEY,
  FORM_MODE_KEY,
  NOTIF_PREFIX,
  PAGE_SIZE_KEY,
  RADIUS_KEY,
  THEME_PREFIX,
  type Density,
  type FormMode,
  applyDensity,
  currentTheme,
  readBool,
  readColor,
  readDensity,
  readFormMode,
  readPageSize,
  readRadius,
} from '../settings-init'

const TABS = (): Array<{ label: string; value: string }> => [
  { label: t('settings.tab.general'), value: 'general' },
  { label: t('settings.tab.notification'), value: 'notification' },
  { label: t('settings.tab.appearance'), value: 'appearance' },
]

const FORM_MODE_OPTIONS = (): Array<{ label: string; value: FormMode; desc: string }> => [
  {
    label: t('settings.formMode.dialog'),
    value: 'dialog',
    desc: t('settings.formMode.dialogDesc'),
  },
  {
    label: t('settings.formMode.drawer'),
    value: 'drawer',
    desc: t('settings.formMode.drawerDesc'),
  },
  { label: t('settings.formMode.page'), value: 'page', desc: t('settings.formMode.pageDesc') },
]

const DENSITY_OPTIONS = (): Array<{ label: string; value: Density }> => [
  { label: t('settings.density.compact'), value: 'compact' },
  { label: t('settings.density.default'), value: 'default' },
  { label: t('settings.density.large'), value: 'large' },
]

const PAGE_SIZE_OPTIONS = (): Array<{ label: string; value: string }> =>
  [5, 10, 20, 50].map((n) => ({
    label: t('settings.pageSizeItem', { count: n }),
    value: String(n),
  }))

const NOTIF_ROWS = (): Array<{ key: string; label: string }> => [
  { key: 'orders', label: t('settings.notif.orders') },
  { key: 'inventory', label: t('settings.notif.inventory') },
  { key: 'system', label: t('settings.notif.system') },
]
const NOTIF_CHANNELS = (): Array<{ key: string; label: string }> => [
  { key: 'inapp', label: t('settings.notif.inapp') },
  { key: 'email', label: t('settings.notif.email') },
]

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
          <h1 class="page-title">${t('nav.settings')}</h1>
          <p class="page-subtitle">${t('settings.subtitle')}</p>
        </div>
      </div>
      <oas-card class="settings-card" title="${t('settings.cardTitle')}"></oas-card>
    </div>`

  const card = el.querySelector<HTMLElement>('.settings-card')!
  card.appendChild(tabs)
  card.appendChild(general.node)
  card.appendChild(notification.node)
  card.appendChild(appearance.node)
  tabs.innerHTML = TABS()
    .map((t) => `<oas-tab-panel label="${t.label}" value="${t.value}"></oas-tab-panel>`)
    .join('')
  tabs.setAttribute('active', 'general')

  function switchPanel(value: string): void {
    ;[general, notification, appearance].forEach((p) => {
      p.node.hidden = p.node.dataset.panel !== value
    })
    tabs.setAttribute('active', value)
  }

  general.set(`
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.general.formModeTitle')}</div>
      <div class="form-hint">${t('settings.general.formModeHint')}</div>
      <div class="radio-group" data-testid="form-mode-group" id="form-mode-group">
        ${FORM_MODE_OPTIONS()
          .map(
            (o) =>
              `<oas-radio name="formMode" value="${o.value}"${readFormMode() === o.value ? ' checked' : ''}><span class="radio-item"><span class="radio-label">${o.label}</span><span class="radio-desc">${o.desc}</span></span></oas-radio>`,
          )
          .join('')}
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.general.densityTitle')}</div>
      <div class="radio-group inline" data-testid="density-group" id="density-group">
        ${DENSITY_OPTIONS()
          .map(
            (o) =>
              `<oas-radio name="density" value="${o.value}"${readDensity() === o.value ? ' checked' : ''}>${o.label}</oas-radio>`,
          )
          .join('')}
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.general.pageSizeLabel')}</div>
          <div class="setting-hint">${t('settings.general.pageSizeHint')}</div>
        </div>
        <oas-select data-testid="page-size" options='${JSON.stringify(PAGE_SIZE_OPTIONS())}' value="${readPageSize()}"></oas-select>
      </div>
    </div>`)

  notification.set(`
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.notif.title')}</div>
      <div class="notif-matrix" data-testid="notif-matrix" id="notif-matrix">
        <div class="notif-row notif-head">
          <span>${t('settings.notif.type')}</span>
          ${NOTIF_CHANNELS()
            .map((c) => `<span class="notif-col">${c.label}</span>`)
            .join('')}
        </div>
        ${NOTIF_ROWS()
          .map(
            (row) => `
          <div class="notif-row">
            <span class="notif-channel">${row.label}</span>
            ${NOTIF_CHANNELS()
              .map(
                (c) =>
                  `<span class="notif-col"><oas-switch data-testid="notif-${row.key}-${c.key}" data-key="${row.key}.${c.key}"${readBool(NOTIF_PREFIX + row.key + '.' + c.key, true) ? ' checked' : ''}></oas-switch></span>`,
              )
              .join('')}
          </div>`,
          )
          .join('')}
      </div>
    </div>`)

  appearance.set(`
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.appearance.colorTitle')}</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.appearance.primaryLabel')}</div>
          <div class="setting-hint">${t('settings.appearance.primaryHint')}</div>
        </div>
        <oas-color-picker data-testid="appearance-color" id="appearance-color" value="${readColor()}"></oas-color-picker>
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.appearance.radiusTitle')}</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.appearance.radiusLabel')}</div>
          <div class="setting-hint">${t('settings.appearance.radiusHint')}</div>
        </div>
        <div class="radius-control">
          <oas-slider data-testid="appearance-radius" id="appearance-radius" min="1" max="12" step="1" value="${readRadius()}"></oas-slider>
          <span id="radius-value" class="mono">${readRadius()}px</span>
        </div>
      </div>
    </div>
    <div class="setting-group">
      <oas-button data-testid="appearance-reset" type="default">${t('settings.appearance.reset')}</oas-button>
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
    message.success(t('common.saved'))
  })

  densityGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0] as HTMLElement
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value')
    if (!v) return
    localStorage.setItem(DENSITY_KEY, v)
    applyDensity()
    message.success(t('common.saved'))
  })

  pageSize.addEventListener('oas-change', (e) => {
    const v = (e as CustomEvent<{ value: string }>).detail.value
    if (!v) return
    localStorage.setItem(PAGE_SIZE_KEY, v)
    message.success(t('common.saved'))
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
    message.success(t('settings.appearance.resetDone'))
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
