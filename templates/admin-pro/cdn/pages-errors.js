/**
 * 错误提示页三件套（自 vanilla forbidden.ts / not-found.ts / server-error.ts 去 TS 移植）
 * 403 无权访问 / 404 页面不存在 / 500 服务器错误，模板与交互同构仅文案与图标差异
 */
import { onLocaleChange, t } from './i18n.js'

/**
 * @param {string} code 状态码文案（403 / 404 / 500）
 * @param {string} iconKey oas-icon 图标名
 * @param {string} iconClass 图标配色修饰类
 * @param {string} titleKey 标题 i18n 键
 * @param {string} descKey 描述 i18n 键
 */
function noticeRender(code, iconKey, iconClass, titleKey, descKey) {
  return (el) => {
    function draw() {
      document.title = `${t(titleKey)} · ${t('app.title')}`
      el.innerHTML = `
      <div class="page notice">
        <oas-icon class="notice-icon ${iconClass}" name="${iconKey}" size="28"></oas-icon>
        <div class="notice-code">${code}</div>
        <h1 class="notice-title">${t(titleKey)}</h1>
        <p class="notice-desc">${t(descKey)}</p>
        <div class="notice-actions">
          <oas-button type="default" variant="outlined" data-action="back">${t('common.back')}</oas-button>
          <oas-button type="primary" data-action="home">${t('common.home')}</oas-button>
        </div>
      </div>`
      el.querySelector('[data-action="home"]')?.addEventListener('click', () => {
        location.hash = '#/dashboard'
      })
      el.querySelector('[data-action="back"]')?.addEventListener('click', () => {
        if (history.length > 1) history.back()
        else location.hash = '#/dashboard'
      })
    }
    draw()
    return onLocaleChange(draw)
  }
}

export const renderForbidden = noticeRender(
  '403',
  'lock',
  'notice-icon--lock',
  'common.403.title',
  'common.403.desc',
)

export const renderNotFound = noticeRender(
  '404',
  'search',
  'notice-icon--search',
  'common.404.title',
  'common.404.desc',
)

export const renderServerError = noticeRender(
  '500',
  'error',
  'notice-icon--error',
  'common.500.title',
  'common.500.desc',
)
