import { message } from '@oas-ui/ui/feedback/message'
import { routes } from '../router/routes'
import { resolve } from '../router/router'
import { session } from '../store/session'

export function render(el: HTMLElement): () => void {
  const user = session.user!
  el.innerHTML = `
    <div class="page">
      <h1 class="page-title">个人中心</h1>
      <oas-card style="max-width: 560px">
        <oas-descriptions title="当前登录" column="2">
          <oas-descriptions-item label="用户名"><span id="profile-name"></span></oas-descriptions-item>
          <oas-descriptions-item label="角色"><span id="profile-role"></span></oas-descriptions-item>
        </oas-descriptions>
        <oas-space>
          <oas-button id="profile-logout" type="danger">退出登录</oas-button>
        </oas-space>
      </oas-card>
    </div>`

  el.querySelector<HTMLElement>('#profile-name')!.textContent = user.name
  el.querySelector<HTMLElement>('#profile-role')!.textContent =
    user.role === 'admin' ? '管理员' : '访客（只读）'

  el.querySelector('#profile-logout')!.addEventListener('click', () => {
    session.logout()
    message.info('已退出登录')
    location.hash = routes[0].path
    void resolve()
  })

  return () => {}
}
