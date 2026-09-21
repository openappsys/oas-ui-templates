// e2e/products.spec.ts —— 商品管理用例（移植自 react/e2e/products.spec.ts，断言语义逐条对齐）
// MPA 适配：SPA 内路由点击 → HTML 直达（products.html / product-edit.html 真实浏览器导航）；
// localStorage 键前缀 oas-admin-cdn-mpa.*；viewer 角色分支跳过（本模版会话无 role，见 _helpers.ts）
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors, setLocal } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('admin 商品管理：卡片/列表双视图切换，列表含开关与操作列', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/products.html')
  await expect(page.getByTestId('product-grid')).toContainText('无线降噪耳机')
  await expect(page.getByTestId('product-view')).toHaveAttribute('value', 'cards')

  await page.getByTestId('product-view').getByText('列表').click()
  await expect(page.getByTestId('product-view')).toHaveAttribute('value', 'table')
  await expect(page.getByTestId('product-table')).toBeVisible()
  await expect(page.getByTestId('product-table')).toContainText('无线降噪耳机')
  expect(await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.products-view'))).toBe(
    'table',
  )

  await page.getByTestId('product-view').getByText('卡片').click()
  await expect(page.getByTestId('product-view')).toHaveAttribute('value', 'cards')
  await expect(page.getByTestId('product-grid')).toBeVisible()
  expect(errors).toEqual([])
})

test('admin 商品管理：dialog 模式下新建表单以对话框呈现', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await setLocal(page, 'oas-admin-cdn-mpa.form-mode', 'dialog')
  await page.goto('/products.html')
  await page.getByTestId('product-create').click()
  await expect(page.getByTestId('product-dialog')).toHaveAttribute('visible', '')
  await page.getByTestId('pf-save').click()
  await expect(page.getByTestId('product-dialog').locator('.error-text')).toContainText(
    '请输入商品名称',
  )
  await expect(page.getByTestId('product-dialog')).toHaveAttribute('visible', '')
  expect(errors).toEqual([])
})

test('admin 商品管理：page 模式下新建跳转整页表单（真实导航 product-edit.html）', async ({
  page,
}) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await setLocal(page, 'oas-admin-cdn-mpa.form-mode', 'page')
  await page.goto('/products.html')
  await expect(page.getByTestId('product-create')).toBeVisible()
  await page.getByTestId('product-create').click()
  // MPA：page 模式 = location.href 整页跳转（SPA 版是 hash 路由 /#/products/edit）
  await page.waitForURL(/product-edit\.html$/)
  // oas-page-header 的 title 为消费式属性，断言走 shadow [part~=title]
  await expect(page.getByTestId('pe-page-header').locator('[part~="title"]')).toHaveText('新建商品')
  await page.getByTestId('pe-save').click()
  await expect(page.locator('.error-text')).toContainText('请输入商品名称')
  expect(errors).toEqual([])
})

async function openProductsTable(page: Parameters<typeof login>[0]): Promise<void> {
  await page.goto('/products.html')
  await expect(page.getByTestId('product-view')).toBeVisible()
  if ((await page.getByTestId('product-view').getAttribute('value')) !== 'table') {
    await page.getByTestId('product-view').getByText('列表').click()
  }
  await expect(page.getByTestId('product-table')).toBeVisible()
}

test('admin 商品管理：表格多选批量删除', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openProductsTable(page)
  const table = page.getByTestId('product-table')

  await table.locator('tr[data-key="1"] input[type="checkbox"]').check()
  await table.locator('tr[data-key="2"] input[type="checkbox"]').check()
  await expect(page.getByTestId('product-batch-bar')).toContainText('已选 2 项')
  await expect(page.getByTestId('product-batch-delete')).toBeEnabled()

  await page.getByTestId('product-batch-delete').click()
  await expect(
    page.locator('[data-testid="product-batch-del-pop"][open] [part="ok"]'),
  ).toBeVisible()
  await page.locator('[data-testid="product-batch-del-pop"][open] [part="ok"]').click()
  await expect(table).not.toContainText('无线降噪耳机')
  await expect(table).not.toContainText('智能手表')
  await expect(page.getByTestId('product-batch-bar')).toBeHidden()
  expect(errors).toEqual([])
})

test('admin 商品管理：批量上架/下架翻转选中项', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openProductsTable(page)
  const table = page.getByTestId('product-table')

  await table.locator('tr[data-key="4"] input[type="checkbox"]').check()
  await page.getByTestId('product-batch-list').click()
  // 批量操作 → 异步 refresh 重渲染，toHaveAttribute 自动重试兜底
  await expect(table.locator('tr[data-key="4"] oas-switch')).toHaveAttribute('checked', '')

  await table.locator('tr[data-key="1"] input[type="checkbox"]').check()
  await page.getByTestId('product-batch-unlist').click()
  await expect(table.locator('tr[data-key="1"] oas-switch')).not.toHaveAttribute('checked')
  expect(errors).toEqual([])
})

test('admin 商品管理：列设置显隐列并持久化（reload 后保持）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openProductsTable(page)
  const table = page.getByTestId('product-table')

  await page.getByTestId('product-columns').click()
  await expect(page.getByTestId('product-columns-modal')).toHaveAttribute('visible', '')
  // oas-checkbox 死区：点 shadow 内 input
  await page.getByTestId('product-columns-price').locator('input').uncheck()
  await expect(table.locator('th[data-key="price"]')).toHaveCount(0)
  await expect(table).not.toContainText('价格')
  await page.getByTestId('product-columns-close').click()
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.products.columns')),
  ).toBe(JSON.stringify(['name', 'category', 'stock', 'status', 'action']))

  await page.reload()
  await openProductsTable(page)
  await expect(page.getByTestId('product-table').locator('th[data-key="price"]')).toHaveCount(0)
  expect(errors).toEqual([])
})
