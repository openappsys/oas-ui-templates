// e2e/tabs.spec.ts —— 多页签栏用例（7 例）
// 移植自 vanilla-html/e2e/tabs.spec.ts，断言语义逐条对齐。
// 适配记录（子集模版路由表仅 11 条，无 /orders//order-detail）：
// 1. 页签累积/关闭/右键用例：vanilla 第二导航目标为「订单管理」；本模版子集等价取
//    「商品管理」（/products，admin 可见），页签键 /orders → /products
// 2. 「隐藏路由归属父级页签」：vanilla 走订单列表 → 抽屉 → /order-detail；本模版子集的
//    隐藏路由为 /products/edit（meta.parent='/products'），改走「page 表单模式下新建商品」
//    跳转，断言语义不变（不新增独立页签、active 停留父级、父级页签 aria-selected）
// 3. 连续两次 nav 点击之间插入 toHaveURL 等待：vue-router 的 push 是异步导航（懒加载 chunk
//    确认后才改路由），紧贴的第二次点击会取代第一次进行中的导航（页面从不经过 /products，
//    页签少一个）；vanilla 自研 hash 路由同步处理无此窗口。等待首次导航落定后断言不变
// 4. 「隐藏路由归属父级页签」用例的就绪断言：react 版点击「商品管理」后以
//    expect(product-create).toBeVisible() 等页面就绪；本模版改用
//    expect(tabs).toHaveAttribute('active', '/products')——tabs 的 active 随路由提交更新，
//    等价确认导航落定（与第 3 条同一异步窗口），随后点击 product-create 由自动重试兜底
import { expect, test, type Page } from '@playwright/test'

async function noConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill('张伟')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

const tabs = (page: Page) => page.getByTestId('page-tabs')
const tab = (page: Page, label: string) =>
  tabs(page).locator('[role="tab"]').filter({ hasText: label })

test('admin 页签累积：访问多页后页签追加且激活随路由同步', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(1)
  await expect(tabs(page)).toHaveAttribute('active', '/dashboard')

  await page.locator('#nav').getByText('商品管理').click()
  await expect(page).toHaveURL(/#\/products$/)
  await page.locator('#nav').getByText('用户管理').click()
  await expect(page).toHaveURL(/#\/users$/)
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(3)
  await expect(tabs(page)).toHaveAttribute('active', '/users')
  await expect(tab(page, '仪表盘')).toBeVisible()
  await expect(tab(page, '商品管理')).toBeVisible()
  expect(errors).toEqual([])
})

test('admin 点击页签切换路由并回写激活', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('商品管理').click()
  await expect(page).toHaveURL(/#\/products$/)
  await page.locator('#nav').getByText('用户管理').click()
  await expect(page).toHaveURL(/#\/users$/)
  await tab(page, '商品管理').click()
  await expect(page).toHaveURL(/#\/products/)
  await expect(tabs(page)).toHaveAttribute('active', '/products')
  expect(errors).toEqual([])
})

test('admin 关闭当前页签切到相邻页签', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('商品管理').click()
  await expect(page).toHaveURL(/#\/products$/)
  await page.locator('#nav').getByText('用户管理').click()
  await expect(page).toHaveURL(/#\/users$/)
  await expect(tabs(page)).toHaveAttribute('active', '/users')

  await tab(page, '商品管理').locator('[data-ptab-close]').click()
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(2)
  await expect(tabs(page)).toHaveAttribute('active', '/users')

  await tab(page, '用户管理').locator('[data-ptab-close]').click()
  await expect(page).toHaveURL(/#\/dashboard/)
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('admin 隐藏路由归属父级页签：商品编辑页不新增独立页签', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  // page 表单模式下「新建商品」跳 /products/edit（隐藏路由，parent=/products）——
  // 等价 vanilla 的 /order-detail 场景（子集无 /orders//order-detail）
  await page.evaluate(() => localStorage.setItem('oas-admin.form-mode', 'page'))
  await page.locator('#nav').getByText('商品管理').click()
  await expect(tabs(page)).toHaveAttribute('active', '/products')
  await page.getByTestId('product-create').click()
  await page.waitForURL('**/#/products/edit')
  await expect(tabs(page)).toHaveAttribute('active', '/products')
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(2)
  await expect(tab(page, '商品管理')).toHaveAttribute('aria-selected', 'true')
  expect(errors).toEqual([])
})

test('admin 仪表盘页签固定不可关闭', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await expect(tab(page, '仪表盘').locator('[data-ptab-close]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('admin 右键页签弹批量关闭菜单：关闭其他', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('商品管理').click()
  await expect(page).toHaveURL(/#\/products$/)
  await page.locator('#nav').getByText('用户管理').click()
  await expect(page).toHaveURL(/#\/users$/)
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(3)

  await tab(page, '用户管理').click({ button: 'right' })
  const menu = tabs(page).locator('[part="context-menu"]')
  await expect(menu).toBeVisible()
  await menu.getByText('关闭其他').click()

  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(2)
  await expect(tabs(page)).toHaveAttribute('active', '/users')
  expect(errors).toEqual([])
})

test('admin 右键页签：关闭全部清空并回首页', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('商品管理').click()
  await expect(page).toHaveURL(/#\/products$/)
  await page.locator('#nav').getByText('用户管理').click()
  await expect(page).toHaveURL(/#\/users$/)

  await tab(page, '用户管理').click({ button: 'right' })
  const menu = tabs(page).locator('[part="context-menu"]')
  await expect(menu).toBeVisible()
  await menu.getByText('关闭全部').click()

  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(1)
  await expect(page).toHaveURL(/#\/dashboard/)
  await expect(tabs(page)).toHaveAttribute('active', '/dashboard')
  expect(errors).toEqual([])
})
