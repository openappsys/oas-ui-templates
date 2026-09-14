// e2e/category.spec.ts —— 商品分类用例（移植自 react/e2e/system2.spec.ts 分类段，
// 断言语义逐条对齐）：新建入表 + 商品页下拉跨页同步、搜索过滤、编辑回填校验、popconfirm 删除
// MPA 适配：/#/system/category → category.html 直达；「商品页下拉同步」为跨 HTML 页真实导航
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('admin 商品分类：新建分类入表 + 商品页下拉同步', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/category.html')
  await expect(page.getByTestId('category-table')).toContainText('数码')

  await page.getByTestId('category-create').click()
  await expect(page.getByTestId('category-modal')).toHaveAttribute('visible', '')
  await page.getByTestId('cf-name').locator('input').fill('图书')
  await page.getByTestId('cf-code').locator('input').fill('book')
  await page.getByTestId('cf-save').click()
  await expect(page.getByTestId('category-table')).toContainText('图书')

  // MPA：数据层落 localStorage，跨页真实导航后仍可读
  await page.goto('/products.html')
  await page.getByTestId('product-category').click()
  await expect(page.getByTestId('product-category')).toContainText('图书')
  expect(errors).toEqual([])
})

test('admin 商品分类：搜索按名称/编码过滤行', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/category.html')
  await expect(page.getByTestId('category-table').locator('tbody tr')).toHaveCount(4)

  await page.getByTestId('category-search').locator('input').fill('数码')
  await expect(page.getByTestId('category-table').locator('tbody tr')).toHaveCount(1)
  await expect(page.getByTestId('category-table')).toContainText('数码')

  await page.getByTestId('category-search').locator('input').fill('apparel')
  await expect(page.getByTestId('category-table').locator('tbody tr')).toHaveCount(1)
  await expect(page.getByTestId('category-table')).toContainText('服饰')

  await page.getByTestId('category-search').locator('input').fill('')
  await expect(page.getByTestId('category-table').locator('tbody tr')).toHaveCount(4)
  expect(errors).toEqual([])
})

test('admin 商品分类：编辑回填 + 必填校验 + 改名校验生效', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/category.html')
  await expect(page.getByTestId('category-table')).toContainText('数码')

  await page
    .getByTestId('category-table')
    .locator('tr[part="row"]', { hasText: '数码' })
    .locator('[data-testid="category-edit"]')
    .click()
  await expect(page.getByTestId('category-modal')).toHaveAttribute('visible', '')
  await expect(page.locator('#category-modal-title')).toHaveText('编辑分类')
  await expect(page.getByTestId('cf-name').locator('input')).toHaveValue('数码')
  await expect(page.getByTestId('cf-code').locator('input')).toHaveValue('digital')

  await page.getByTestId('cf-name').locator('input').fill('')
  await page.getByTestId('cf-save').click()
  await expect(page.locator('.error-text')).toContainText('请输入分类名称')

  await page.getByTestId('cf-name').locator('input').fill('影音')
  await page.getByTestId('cf-save').click()
  await expect(page.getByTestId('category-table')).toContainText('影音')
  await expect(page.getByTestId('category-table')).not.toContainText('数码')
  expect(errors).toEqual([])
})

test('admin 商品分类：删除需 popconfirm 确认后移除行', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/category.html')
  await expect(page.getByTestId('category-table')).toContainText('食品')

  await page
    .getByTestId('category-table')
    .locator('tr[part="row"]', { hasText: '食品' })
    .locator('[data-testid="category-delete"]')
    .click()
  const popOk = page.locator('[data-testid="category-del-pop"][open] [part="ok"]')
  await expect(popOk).toBeVisible()
  await popOk.click()
  const table = page.getByTestId('category-table')
  // oas-table 重渲染为异步——用 expect.poll 等行数收敛（替代 waitForTimeout 堆叠）
  await expect.poll(async () => table.locator('tbody tr').count()).toBe(3)
  await expect(table).not.toContainText('食品')
  expect(errors).toEqual([])
})
