import { session } from '../store/session'
import { resolve } from '../router/router'
import { routes } from '../router/routes'
import { t } from '../i18n'

type LoginStyle = 'split' | 'glass'

function readStyle(): LoginStyle {
  return new URLSearchParams(location.search).get('style') === 'glass' ? 'glass' : 'split'
}

function switchStyle(next: LoginStyle): void {
  const params = new URLSearchParams(location.search)
  params.set('style', next)
  location.search = params.toString()
}

const LOGO_LIGHT = `
  <span class="oas-logo oas-logo-light">
    <span class="oas-logo-badge">OAS</span>
    <span class="oas-logo-word">OAS Admin</span>
  </span>`

function formBlock(): string {
  return `
    <div class="login-head">${LOGO_LIGHT}</div>
    <h2 class="login-title">${t('login.welcome')}</h2>
    <p class="login-sub">${t('login.subtitle')}</p>
    <oas-form id="login-form" rules='${JSON.stringify({ name: [{ required: true, message: t('login.rule.name') }] })}'>
      <div class="login-fields">
        <oas-input data-testid="login-name" name="name" placeholder="${t('login.namePlaceholder')}"></oas-input>
        <oas-select data-testid="login-role" name="role" value="admin" options='[{"label":"${t('users.role.admin')}","value":"admin"},{"label":"${t('profile.roleViewer')}","value":"viewer"}]'></oas-select>
        <oas-button data-testid="login-submit" type="primary" block>${t('login.submit')} <oas-icon name="arrow-right" size="14"></oas-icon></oas-button>
      </div>
    </oas-form>
    <div class="login-divider"></div>
    <p class="login-tip">${t('login.tip')}</p>`
}

function splitTemplate(): string {
  return `
    <div class="login-split">
      <div class="login-brand">
        <div class="login-brand-main">
          ${LOGO_LIGHT}
          <h1>${t('login.slogan')}</h1>
          <p>${t('login.sloganSub')}</p>
          <div class="brand-stats">
            <div class="brand-stat"><span class="num">117</span><span class="label">${t('login.statComponents')}</span></div>
            <div class="brand-stat"><span class="num">22KB</span><span class="label">${t('login.statBundle')}</span></div>
            <div class="brand-stat"><span class="num">0</span><span class="label">${t('login.statFrameworks')}</span></div>
          </div>
        </div>
        <pre class="brand-code">&lt;oas-button type="primary"&gt;${t('common.save')}&lt;/oas-button&gt;</pre>
      </div>
      <div class="login-panel">
        <div class="login-card">
          ${formBlock()}
          <button class="link-btn login-alt" type="button" data-style="glass">${t('login.switchGlass')}</button>
        </div>
      </div>
    </div>`
}

function glassTemplate(): string {
  return `
    <div class="login-glass">
      <div class="glass-card" data-theme="dark">
        ${formBlock()}
      </div>
      <div class="glass-foot">
        <p class="glass-slogan">${t('login.glassSlogan')}</p>
        <button class="link-btn link-btn-light" type="button" data-style="split">${t('login.switchSplit')}</button>
      </div>
    </div>`
}

export function render(el: HTMLElement): () => void {
  el.innerHTML = readStyle() === 'glass' ? glassTemplate() : splitTemplate()

  const form = el.querySelector<HTMLElement>('#login-form')!

  form.querySelector('[data-testid="login-submit"]')!.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  form.querySelectorAll('oas-input').forEach((input) => {
    input.addEventListener('oas-enter', () => {
      ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
    })
  })

  form.addEventListener('oas-submit', (e) => {
    const values = (e as CustomEvent<{ values: { name: string; role?: string } }>).detail.values
    session.login(values.name || '用户', values.role === 'viewer' ? 'viewer' : 'admin')
    location.hash = routes[0].path
    void resolve()
  })

  el.querySelectorAll<HTMLButtonElement>('[data-style]').forEach((btn) => {
    btn.addEventListener('click', () => switchStyle(btn.dataset.style as LoginStyle))
  })

  return () => {}
}
