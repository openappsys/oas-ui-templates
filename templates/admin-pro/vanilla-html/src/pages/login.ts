import { session } from '../store/session'
import { resolve } from '../router/router'
import { routes } from '../router/routes'

export function render(el: HTMLElement): () => void {
  el.innerHTML = `
    <div class="login-wrap">
      <oas-card title="OAS Admin 登录" class="login-card">
        <oas-form id="login-form" rules='{"name":[{"required":true,"message":"请输入用户名"}]}'>
          <oas-space direction="vertical" style="width: 100%">
            <oas-input data-testid="login-name" name="name" placeholder="用户名（任意）"></oas-input>
            <oas-select data-testid="login-role" name="role" value="admin" options='[{"label":"管理员","value":"admin"},{"label":"访客（只读）","value":"viewer"}]'></oas-select>
            <oas-button data-testid="login-submit" type="primary">登录</oas-button>
          </oas-space>
        </oas-form>
      </oas-card>
      <p class="login-tip">演示模版：无后端，任意用户名 + 角色即登录</p>
    </div>`

  const form = el.querySelector<HTMLElement>('#login-form')!

  form.querySelectorAll('oas-input').forEach((input) => {
    input.addEventListener('oas-input', (e) => {
      input.setAttribute('value', (e as CustomEvent<{ value: string }>).detail.value)
    })
  })

  form.querySelector('[data-testid="login-submit"]')!.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  form.addEventListener('oas-submit', (e) => {
    const values = (e as CustomEvent<{ values: { name: string; role?: string } }>).detail.values
    session.login(values.name || '用户', values.role === 'viewer' ? 'viewer' : 'admin')
    location.hash = routes[0].path
    void resolve()
  })

  return () => {}
}
