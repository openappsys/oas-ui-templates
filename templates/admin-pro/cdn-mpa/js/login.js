import { readSession, writeSession } from './session.js'
import { t } from './i18n.js'

// 已登录访问登录页 → 直接进 dashboard
if (readSession()) {
  location.href = './dashboard.html'
} else {
  document.title = `${t('login.title')} · ${t('app.title')}`
  const app = document.querySelector('#app')
  app.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <h1>${t('login.title')}</h1>
        <p class="sub">${t('login.subtitle')}</p>
        <oas-input data-testid="login-name" placeholder="${t('login.namePh')}"></oas-input>
        <oas-button data-testid="login-submit" type="primary">${t('login.submit')}</oas-button>
        <p class="login-tip">${t('login.tip')}</p>
      </div>
    </div>`
  const input = app.querySelector('[data-testid="login-name"]')
  const submit = () => {
    const name = (input.shadowRoot?.querySelector('input')?.value ?? '').trim()
    if (!name) return
    writeSession(name)
    location.href = './dashboard.html'
  }
  app.querySelector('[data-testid="login-submit"]').addEventListener('click', submit)
  input.addEventListener('oas-enter', submit)
}
