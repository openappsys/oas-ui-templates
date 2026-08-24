import { session } from '../store/session'
import { resolve } from '../router/router'
import { routes } from '../router/routes'

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
    <h2 class="login-title">欢迎回来</h2>
    <p class="login-sub">使用演示账号登录（无需密码）</p>
    <oas-form id="login-form" rules='{"name":[{"required":true,"message":"请输入用户名"}]}'>
      <div class="login-fields">
        <oas-input data-testid="login-name" name="name" placeholder="用户名（任意）"></oas-input>
        <oas-select data-testid="login-role" name="role" value="admin" options='[{"label":"管理员","value":"admin"},{"label":"访客（只读）","value":"viewer"}]'></oas-select>
        <oas-button data-testid="login-submit" type="primary" block>登录 <oas-icon name="arrow-right" size="14"></oas-icon></oas-button>
      </div>
    </oas-form>
    <div class="login-divider"></div>
    <p class="login-tip">演示模版 · 任意用户名即可进入</p>`
}

function splitTemplate(): string {
  return `
    <div class="login-split">
      <div class="login-brand">
        <div class="login-brand-main">
          ${LOGO_LIGHT}
          <h1>一套组件，到处运行</h1>
          <p>零框架运行时 · 浏览器原生 Web Components</p>
          <div class="brand-stats">
            <div class="brand-stat"><span class="num">117</span><span class="label">组件库组件</span></div>
            <div class="brand-stat"><span class="num">22KB</span><span class="label">按钮链体积</span></div>
            <div class="brand-stat"><span class="num">0</span><span class="label">框架运行时依赖</span></div>
          </div>
        </div>
        <pre class="brand-code">&lt;oas-button type="primary"&gt;保存&lt;/oas-button&gt;</pre>
      </div>
      <div class="login-panel">
        <div class="login-card">
          ${formBlock()}
          <button class="link-btn login-alt" type="button" data-style="glass">切换玻璃版</button>
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
        <p class="glass-slogan">框架无关 · Web Components UI</p>
        <button class="link-btn link-btn-light" type="button" data-style="split">切换分屏版</button>
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
