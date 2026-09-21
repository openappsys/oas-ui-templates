/**
 * 设置中心·四 Tab 面板 HTML（自 vanilla src/pages/settings.ts 面板段去 TS 移植）
 * 仅负责模板字符串；事件绑定与持久化在 pages-settings.js
 */
import { t } from './i18n.js'
import {
  canPosition,
  MENU_POSITIONS,
  MENU_STYLES,
  readBool,
  readColor,
  readDensity,
  readFontSize,
  readFormMode,
  readPageSize,
  readRadius,
  readTabsBar,
  NOTIF_PREFIX,
} from './js/settings.js'

const FONT_SIZE_MAP = {
  xs: 'settings.fontSize.xs',
  sm: 'settings.fontSize.sm',
  md: 'settings.fontSize.md',
  lg: 'settings.fontSize.lg',
  xl: 'settings.fontSize.xl',
}

export const FONT_SIZE_OPTIONS = ['xs', 'sm', 'md', 'lg', 'xl']

const FONT_SIZE_ITEMS = () =>
  FONT_SIZE_OPTIONS.map((o) => ({ label: t(FONT_SIZE_MAP[o]), value: o }))

export const TAB_LAYOUT_OPTIONS = () => [
  { label: t('settings.tabsLayout.horizontal'), value: 'horizontal' },
  { label: t('settings.tabsLayout.vertical'), value: 'vertical' },
]

const FORM_MODE_OPTIONS = () => [
  {
    value: 'dialog',
    label: t('settings.formMode.dialog'),
    desc: t('settings.formMode.dialogDesc'),
  },
  {
    value: 'drawer',
    label: t('settings.formMode.drawer'),
    desc: t('settings.formMode.drawerDesc'),
  },
  { value: 'page', label: t('settings.formMode.page'), desc: t('settings.formMode.pageDesc') },
]

const DENSITY_OPTIONS = () => [
  { value: 'compact', label: t('settings.density.compact') },
  { value: 'default', label: t('settings.density.default') },
  { value: 'large', label: t('settings.density.large') },
]

const PAGE_SIZE_OPTIONS = () =>
  [5, 10, 20, 50].map((n) => ({
    label: t('settings.pageSizeItem', { count: n }),
    value: String(n),
  }))

const MENU_STYLES_META = [
  { value: 'sidebar', label: 'menuStyleSidebar' },
  { value: 'menubar', label: 'menuStyleMenubar' },
  { value: 'navigation', label: 'menuStyleNavigation' },
]
const MENU_POSITIONS_META = [
  { value: 'left', label: 'menuLeft' },
  { value: 'right', label: 'menuRight' },
  { value: 'top', label: 'menuTop' },
  { value: 'top-head', label: 'menuTopHead' },
]

/** 9 宫格菜单矩阵表头（位置列名） */
const MENU_MATRIX_HEADER = `<div class="menu-matrix-corner"></div>${MENU_POSITIONS_META.map(
  (p) => `<div class="menu-matrix-head">${t(`settings.general.${p.label}`)}</div>`,
).join('')}`

/** 9 宫格菜单矩阵行：行=形态、列=位置；sidebar+top 不可选（禁用） */
const MENU_MATRIX_ROWS = () =>
  MENU_STYLES_META.map(
    (s) =>
      `<div class="menu-matrix-rowlabel">${t(`settings.general.${s.label}`)}</div>${MENU_POSITIONS_META.map(
        (p) => {
          const ok = canPosition(s.value, p.value)
          return `<button type="button" class="menu-matrix-cell${ok ? '' : ' is-disabled'}" role="radio" data-style="${s.value}" data-position="${p.value}"${ok ? '' : ' disabled'} aria-label="${t(`settings.general.${s.label}`)} · ${t(`settings.general.${p.label}`)}"></button>`
        },
      ).join('')}`,
  ).join('')

const NOTIF_ROWS = () => [
  { key: 'orders', label: t('settings.notif.orders') },
  { key: 'inventory', label: t('settings.notif.inventory') },
  { key: 'system', label: t('settings.notif.system') },
]
const NOTIF_CHANNELS = () => [
  { key: 'inapp', label: t('settings.notif.inapp') },
  { key: 'email', label: t('settings.notif.email') },
]

/** 外观：主题色/圆角/字体大小/表格密度/主题编辑器/重置 */
export function appearanceHtml() {
  return `
    <div class="setting-group">
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.appearance.primaryLabel')}</div>
          <div class="setting-hint">${t('settings.appearance.primaryHint')}</div>
        </div>
        <oas-color-picker data-testid="appearance-color" id="appearance-color" value="${readColor()}"></oas-color-picker>
      </div>
    </div>
    <div class="setting-group">
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
      <div class="setting-group-title">${t('settings.general.fontSizeTitle')}</div>
      <div class="radio-group inline" data-testid="font-size-group" id="font-size-group">
        ${FONT_SIZE_ITEMS()
          .map(
            (o) =>
              `<oas-radio name="fontSize" value="${o.value}"${readFontSize() === o.value ? ' checked' : ''}>${o.label}</oas-radio>`,
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
      <div class="setting-group-title">${t('settings.appearance.themeEditorTitle')}</div>
      <div class="setting-hint">${t('settings.appearance.themeEditorHint')}</div>
      <oas-theme-editor data-testid="settings-theme-editor" id="settings-theme-editor"></oas-theme-editor>
    </div>
    <div class="setting-group">
      <oas-button data-testid="appearance-reset" type="default">${t('settings.appearance.reset')}</oas-button>
    </div>`
}

/**
 * 布局与导航：菜单形态矩阵 + 多页签栏。
 * cdn 偏差：vanilla 的「路由模式」控件不渲染——cdn 为哈希单模式，无 router-mode 概念（控件位留空）。
 * 菜单矩阵/页签栏开关仅持久化 localStorage，cdn 壳层暂不消费（形态升级预留，语义与 vanilla 一致）。
 */
export function layoutHtml() {
  return `
    <div class="setting-group">
      <div class="setting-label setting-group-title">${t('settings.general.menuStyleLabel')}</div>
      <div class="setting-hint">${t('settings.general.menuStyleHint')}</div>
      <div class="menu-matrix" data-testid="menu-matrix" role="radiogroup" aria-label="${t('settings.general.menuStyleLabel')}">
        ${MENU_MATRIX_HEADER}
        ${MENU_MATRIX_ROWS()}
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.general.tabsBarLabel')}</div>
          <div class="setting-hint">${t('settings.general.tabsBarHint')}</div>
        </div>
        <oas-switch data-testid="tabs-bar-toggle"${readTabsBar() ? ' checked' : ''}></oas-switch>
      </div>
    </div>`
}

/** 数据与列表：表单呈现方式/每页条数 */
export function dataHtml() {
  return `
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
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.general.pageSizeLabel')}</div>
          <div class="setting-hint">${t('settings.general.pageSizeHint')}</div>
        </div>
        <oas-select data-testid="page-size" options='${JSON.stringify(PAGE_SIZE_OPTIONS())}' value="${readPageSize()}"></oas-select>
      </div>
    </div>`
}

/** 通知：3 类型 × 2 渠道开关矩阵 */
export function notificationHtml() {
  return `
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
    </div>`
}
