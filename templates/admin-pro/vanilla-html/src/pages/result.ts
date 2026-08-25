export function render(el: HTMLElement): () => void {
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
      <oas-result data-testid="form-result" status="success" title="创建成功" description="订单号 ${orderId}">
        <div slot="extra" class="result-actions">
          <oas-button data-testid="result-view-order" type="primary">查看订单</oas-button>
          <oas-button data-testid="result-reset">再建一单</oas-button>
        </div>
      </oas-result>
    ${close}`
  } else {
    el.innerHTML = `${wrap}
      <oas-result data-testid="form-result" status="error" title="演示失败态" description="提交未成功，请返回表单重试">
        <div slot="extra" class="result-actions">
          <oas-button data-testid="result-back-form" type="primary">返回表单</oas-button>
        </div>
      </oas-result>
    ${close}`
  }

  const nav = (path: string): void => {
    location.hash = path
  }
  el.querySelector<HTMLElement>('[data-testid="result-view-order"]')?.addEventListener('click', () =>
    nav('/orders'),
  )
  el.querySelector<HTMLElement>('[data-testid="result-reset"]')?.addEventListener('click', () =>
    nav('/form'),
  )
  el.querySelector<HTMLElement>('[data-testid="result-back-form"]')?.addEventListener('click', () =>
    nav('/form'),
  )

  return () => {}
}
