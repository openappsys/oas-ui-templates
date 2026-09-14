import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'

if (guard()) {
  document.title = `${t('nav.result')} · ${t('app.title')}`
  applyStaticTexts()
  // 隐藏路由：无侧栏高亮；面包屑 创建订单 → 结果（MPA 演示流：创建订单向导 → 结果）
  initShell({ active: '' })
  window.OASShell.setBreadcrumb([
    { label: 'nav.createOrder', href: './form.html' },
    { label: 'nav.result' },
  ])
  renderResult()
}

function renderResult() {
  // 读创建订单向导写入的结果标记（读后即焚）；直接访问（无标记）时自然落入失败态演示
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

  const view = document.querySelector('#result-view')
  if (success) {
    view.innerHTML = `
      <oas-result data-testid="form-result" status="success" title="${t('result.success.title')}" description="${tf('result.success.desc', { orderId })}">
        <div slot="extra" class="result-actions">
          <oas-button data-testid="result-view-order" type="primary">${t('result.viewOrder')}</oas-button>
          <oas-button data-testid="result-reset">${t('result.createAnother')}</oas-button>
        </div>
      </oas-result>`
    view
      .querySelector('[data-testid="result-view-order"]')
      .addEventListener('click', () => (location.href = './orders.html'))
    view
      .querySelector('[data-testid="result-reset"]')
      .addEventListener('click', () => (location.href = './form.html'))
  } else {
    view.innerHTML = `
      <oas-result data-testid="form-result" status="error" title="${t('result.error.title')}" description="${t('result.error.desc')}">
        <div slot="extra" class="result-actions">
          <oas-button data-testid="result-back-form" type="primary">${t('result.backForm')}</oas-button>
        </div>
      </oas-result>`
    view
      .querySelector('[data-testid="result-back-form"]')
      .addEventListener('click', () => (location.href = './form.html'))
  }
}
