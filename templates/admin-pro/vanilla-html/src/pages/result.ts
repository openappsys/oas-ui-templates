import { destroyAll } from '@oas-ui/ui/feedback/message'
import { t } from '../i18n'

export function render(el: HTMLElement): () => void {
  destroyAll()
  let success = false
  let orderId = ''
  try {
    const raw = sessionStorage.getItem('form-result')
    if (raw) {
      const data = JSON.parse(raw) as { status?: string; orderId?: string }
      success = data.status === 'success'
      orderId = data.orderId ?? ''
    }
  } catch {
    success = false
  }
  sessionStorage.removeItem('form-result')

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

  const nav = (path: string): void => {
    location.hash = path
  }
  el.querySelector<HTMLElement>('[data-testid="result-view-order"]')?.addEventListener(
    'click',
    () => nav('/orders'),
  )
  el.querySelector<HTMLElement>('[data-testid="result-reset"]')?.addEventListener('click', () =>
    nav('/form'),
  )
  el.querySelector<HTMLElement>('[data-testid="result-back-form"]')?.addEventListener('click', () =>
    nav('/form'),
  )

  return () => {}
}
