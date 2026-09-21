/**
 * 结果页（自 vanilla src/pages/result.ts 去 TS 移植）
 * 状态取自 sessionStorage 键 form-result（高级表单提交结果）；无数据时展示失败态
 */
import { onLocaleChange, t } from './i18n.js'

export function renderResult(el) {
  // 清残留 message 浮层（vanilla destroyAll 同语义）
  try {
    window.OASUI?.message?.destroyAll?.()
  } catch {
    /* 组件未就绪时忽略 */
  }
  let success = false
  let orderId = ''
  try {
    const raw = sessionStorage.getItem('form-result')
    if (raw) {
      const data = JSON.parse(raw)
      success = data.status === 'success'
      orderId = data.orderId ?? ''
    }
  } catch {
    success = false
  }
  sessionStorage.removeItem('form-result')

  function draw() {
    document.title = `${t('nav.result')} · ${t('app.title')}`
    const wrap = `<div class="page result-page"><div class="result-wrap">`
    const close = `</div></div>`

    if (success) {
      el.innerHTML = `${wrap}
      <oas-result data-testid="form-result" status="success" title="${t('result.success.title')}" description="${t('result.success.desc', { orderId })}">
        <div slot="extra" class="result-actions">
          <oas-button data-testid="result-view-order" type="primary">${t('result.viewOrder')}</oas-button>
          <oas-button data-testid="result-reset">${t('result.createAnother')}</oas-button>
        </div>
      </oas-result>
    ${close}`
    } else {
      el.innerHTML = `${wrap}
      <oas-result data-testid="form-result" status="error" title="${t('result.error.title')}" description="${t('result.error.desc')}">
        <div slot="extra" class="result-actions">
          <oas-button data-testid="result-back-form" type="primary">${t('result.backForm')}</oas-button>
        </div>
      </oas-result>
    ${close}`
    }

    const nav = (path) => {
      location.hash = `#${path}`
    }
    el.querySelector('[data-testid="result-view-order"]')?.addEventListener('click', () =>
      nav('/orders'),
    )
    el.querySelector('[data-testid="result-reset"]')?.addEventListener('click', () => nav('/form'))
    el.querySelector('[data-testid="result-back-form"]')?.addEventListener('click', () =>
      nav('/form'),
    )
  }

  draw()
  return onLocaleChange(draw)
}
