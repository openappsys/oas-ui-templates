// e2e/system2.spec.ts —— 系统管理页用例二（移植自 react/e2e/system2.spec.ts 字典/分类/用户段，
// 断言语义逐条对齐）：字典键值、商品分类 CRUD 四连、用户角色列与行编辑回填
// 适配点：cdn 无角色系统——react 版「viewer 操作权限禁用按钮」「viewer 数据权限提示条」
// 「用户详情弹窗权限标识」不移植（cdn 用户页为轻量实现，无详情弹窗）；
// 行编辑按钮改用 cdn 的 [data-edit] 属性定位（react 版为 user-row-edit testid）
import { expect, test } from '@playwright/test'
import { beforeEachMock, login, noConsoleErrors } from './helpers'

beforeEachMock()

test('字典管理：切换类型 + 新建键值', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/system/dict')
  await expect(page.getByTestId('dict-type-list')).toContainText('订单状态')
  await expect(page.getByTestId('dict-items-table')).toContainText('待支付')

  await page.getByTestId('dict-item-create').click()
  await expect(page.getByTestId('dict-item-modal')).toHaveAttribute('visible', '')
  await page.getByTestId('dif-label').locator('input').fill('预售')
  await page.getByTestId('dif-value').locator('input').fill('presale')
  await page.getByTestId('dif-save').click()
  await expect(page.getByTestId('dict-items-table')).toContainText('预售')
  expect(errors).toEqual([])
})

test('商品分类：新建分类入表 + 商品页下拉同步', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/system/category')
  await expect(page.getByTestId('category-table')).toContainText('数码')

  await page.getByTestId('category-create').click()
  await expect(page.getByTestId('category-modal')).toHaveAttribute('visible', '')
  await page.getByTestId('cf-name').locator('input').fill('图书')
  await page.getByTestId('cf-code').locator('input').fill('book')
  await page.getByTestId('cf-save').click()
  await expect(page.getByTestId('category-table')).toContainText('图书')

  await page.goto('/#/products')
  await page.getByTestId('product-category').click()
  await expect(page.getByTestId('product-category')).toContainText('图书')
  expect(errors).toEqual([])
})

test('商品分类：搜索按名称/编码过滤行', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/system/category')
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

test('商品分类：编辑回填 + 必填校验 + 改名校验生效', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/system/category')
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

test('商品分类：删除需 popconfirm 确认后移除行', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/system/category')
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
  await expect.poll(async () => table.locator('tbody tr').count()).toBe(3)
  await expect(table).not.toContainText('食品')
  expect(errors).toEqual([])
})

test('用户管理：角色列取角色名 + 行编辑按钮打开回填表单', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/users')
  await expect(page.getByTestId('users-table')).toContainText('张伟')
  await expect(page.getByTestId('users-table')).toContainText('管理员')

  // 注意：oas-table 行编辑按钮会连带派发 oas-row-click（vanilla 同款边界），
  // cdn 用户页未监听行点击，仅打开编辑弹窗
  await page.getByTestId('users-table').locator('[data-edit]').first().click()
  await expect(page.getByTestId('user-form-modal')).toHaveAttribute('visible', '')
  await expect(page.getByTestId('uf-name').locator('input')).toHaveValue('张伟')
  expect(errors).toEqual([])
})
