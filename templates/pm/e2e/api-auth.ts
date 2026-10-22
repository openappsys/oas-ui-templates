import { expect, type APIRequestContext, type Page } from '@playwright/test'

/** 演示口令与 seed 邮箱（mock 认证固定值，见 docs/api.md） */
export const DEMO_PASSWORD = 'oas'
export const DEMO_EMAILS = {
  admin: 'user1@oas.dev',
  member: 'user2@oas.dev',
  viewer: 'user4@oas.dev',
} as const

export type DemoRole = keyof typeof DEMO_EMAILS

/** 走真实登录端点拿 token（不经 UI）：用于 request 上下文与预置会话 */
export async function loginToken(
  request: APIRequestContext,
  role: DemoRole = 'admin',
): Promise<string> {
  const res = await request.post('/api/auth/login', {
    data: { email: DEMO_EMAILS[role], password: DEMO_PASSWORD },
  })
  expect(res.status(), `login as ${role}`).toBe(200)
  const body = (await res.json()) as { token: string }
  return body.token
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

/** 预置 token 到 localStorage：必须在 page.goto 之前调用（否则首屏读到空会话） */
export async function primeSession(
  page: Page,
  request: APIRequestContext,
  role: DemoRole = 'admin',
): Promise<string> {
  const token = await loginToken(request, role)
  await page.addInitScript((value) => {
    localStorage.setItem('oas-pm-token', value)
  }, token)
  return token
}

/** 通过登录页的「快速登录」进入工作台（走得通 UI 全链路） */
export async function quickLogin(page: Page, role: DemoRole = 'admin'): Promise<void> {
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId(`quick-login-${role}`).click()
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 20_000 })
}
