import { expect, test, type Page } from '@playwright/test'
import { DEMO_EMAILS, DEMO_PASSWORD, bearer, loginToken, quickLogin } from './api-auth'

/**
 * API 模式认证链路（mock 服务端 + 登录页 + 会话失效）。
 * Dexie 模式没有登录页（靠「切换身份」演示），不受本 spec 影响。
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('oas-pm-api-init')) {
      localStorage.setItem('oas-pm-data', 'api')
      sessionStorage.setItem('oas-pm-api-init', '1')
    }
  })
})

/** 填 oas-input：property 通道 + oas-input 事件（宿主与内部 input 同步） */
const fillInput = (page: Page, testid: string, value: string) =>
  page.getByTestId(testid).evaluate((el, v) => {
    const input = el as HTMLElement & { value?: string }
    input.value = v
    input.dispatchEvent(new CustomEvent('oas-input', { bubbles: true, detail: { value: v } }))
  }, value)

test('B1 未登录：全屏登录页，工作台不渲染', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('pm-toolbar')).toHaveCount(0)
  await expect(page.getByTestId('login-email')).toBeVisible()
  await expect(page.getByTestId('login-password')).toBeVisible()
  // 三枚快速登录按钮都在
  for (const role of ['admin', 'member', 'viewer'] as const) {
    await expect(page.getByTestId(`quick-login-${role}`)).toBeVisible()
  }
})

test('B2 凭据错误：提示可见，仍停在登录页', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 })
  await fillInput(page, 'login-email', DEMO_EMAILS.admin)
  await fillInput(page, 'login-password', 'wrong-password')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('login-error')).toContainText('邮箱或密码不正确')
  await expect(page.getByTestId('pm-toolbar')).toHaveCount(0)
})

test('B3 密码正确：进入工作台，顶栏显示成员并带登出；登出回登录页', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 })
  await fillInput(page, 'login-email', DEMO_EMAILS.member)
  await fillInput(page, 'login-password', DEMO_PASSWORD)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 20_000 })
  // 登录的是 member-2（李娜），顶栏与 token 一致
  await expect(page.getByTestId('tb-user')).toContainText('李娜')
  const token = await page.evaluate(() => localStorage.getItem('oas-pm-token'))
  expect(token).toMatch(/^mock-/)

  await page.getByTestId('tb-user').click()
  await page.getByTestId('user-menu').getByRole('menuitem', { name: '登出' }).click()
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 })
  expect(await page.evaluate(() => localStorage.getItem('oas-pm-token'))).toBeNull()
  // 服务端 token 已作废：再用旧 token 请求 /api/auth/me 是 401
  const me = await page.request.get('/api/auth/me', { headers: bearer(token ?? '') })
  expect(me.status()).toBe(401)
})

test('B4 快速登录 viewer：前端权限门禁生效（无新建入口/管理入口）', async ({ page }) => {
  await page.goto('/')
  await quickLogin(page, 'viewer')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('toolbar-new')).toHaveCount(0)
  await expect(page.getByTestId('admin-entry')).toHaveCount(0)
})

test('B5 快速登录 admin：管理入口可用（服务端 admin 端点放行）', async ({ page }) => {
  await page.goto('/')
  await quickLogin(page, 'admin')
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible({ timeout: 15_000 })
})

test('B6 会话失效：token 被篡改后任何请求收到 401 → 回登录页并提示', async ({ page }) => {
  await page.goto('/')
  await quickLogin(page, 'admin')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 20_000 })

  // 把 token 换成服务端不认识的串：下一次 revision 轮询（1200ms）即 401
  await page.evaluate(() => localStorage.setItem('oas-pm-token', 'mock-tampered'))
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('login-notice')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('oas-pm-token'))).toBeNull()
})

test('B7 预置有效 token：跳过登录页直接进工作台（启动校验走 /api/auth/me）', async ({
  page,
  request,
}) => {
  const token = await loginToken(request, 'admin')
  await page.addInitScript((value) => {
    localStorage.setItem('oas-pm-token', value)
  }, token)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('login-page')).toHaveCount(0)
})

test('B8 列表首屏请求失败：错误态可见，重试后恢复', async ({ page }) => {
  // 只拦窗口查询本身（计数/轮询不受影响）：模拟服务端 500
  const failures = (url: URL) => url.pathname === '/api/issues'
  await page.route(failures, (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'boom' }),
    }),
  )
  await page.goto('/')
  await quickLogin(page, 'admin')
  await expect(page.getByTestId('list-error')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('list-error-detail')).toContainText('boom')
  await expect(page.locator('.issue-row')).toHaveCount(0)

  await page.unroute(failures)
  await page.getByTestId('list-error-retry').click()
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('list-error')).toHaveCount(0)
})
