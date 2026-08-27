import { expect, test, type Page } from '@playwright/test'

async function noConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

async function login(page: Page, name: string, role: 'admin' | 'viewer'): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill(name)
  if (role === 'viewer') {
    await page.getByTestId('login-role').click()
    await page.getByText('访客（只读）').click()
  }
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

test('admin 部门管理：新建部门入树 + 删除有子部门拦截', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/system/dept')
  await expect(page.getByTestId('dept-tree')).toContainText('总公司')

  await page.getByTestId('dept-create').click()
  await expect(page.getByTestId('dept-form-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('df-name').locator('input').fill('测试部')
  await page.getByTestId('df-save').click()
  await expect(page.getByTestId('dept-tree')).toContainText('测试部')

  await page.getByTestId('dept-tree').getByText('总公司').click()
  await expect(page.getByTestId('dept-detail-members')).toBeVisible()
  await page.locator('[data-md-action="delete"]').click()
  await page.locator('#md-del-pop [part="ok"]').click()
  await expect(page.locator('oas-message').filter({ hasText: '存在子部门' })).toBeVisible()
  await expect(page.getByTestId('dept-tree')).toContainText('总公司')
  expect(errors).toEqual([])
})

test('admin 字典管理：切换类型 + 新建键值', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
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

test('admin 商品分类：新建分类入表 + 商品页下拉同步', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
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

test('admin 商品分类：搜索按名称/编码过滤行', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
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

test('admin 商品分类：编辑回填 + 必填校验 + 改名校验生效', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
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

test('admin 商品分类：删除需 popconfirm 确认后移除行', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/system/category')
  await expect(page.getByTestId('category-table')).toContainText('食品')

  await page
    .getByTestId('category-table')
    .locator('tr[part="row"]', { hasText: '食品' })
    .locator('[data-testid="category-delete"]')
    .click()
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const t = document.querySelector('[data-testid="category-table"]')
    const pop = Array.from(t?.shadowRoot?.querySelectorAll('oas-popconfirm') ?? []).find(
      (x) => x.isConnected && x.hasAttribute('open'),
    ) as HTMLElement | undefined
    pop?.shadowRoot?.querySelector<HTMLButtonElement>('[part="ok"]')?.click()
  })
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          document
            .querySelector('[data-testid="category-table"]')
            ?.shadowRoot?.querySelectorAll('tbody tr').length,
      ),
    )
    .toBe(3)
  await expect(page.getByTestId('category-table')).not.toContainText('食品')
  expect(errors).toEqual([])
})

test('admin 用户管理：角色列取角色名 + 详情权限标识', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/users')
  await expect(page.getByTestId('users-table')).toContainText('超级管理员')

  await page.getByTestId('users-table').getByText('张伟').first().click()
  await expect(page.locator('#detail-name')).toHaveText('张伟')
  await expect(page.locator('#detail-perms-list').locator('oas-tag')).toHaveCount(4)
  expect(errors).toEqual([])
})

test('viewer 用户管理：新建/删除按钮禁用（操作权限）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '李四', 'viewer')
  await page.goto('/#/users')
  await expect(page.getByTestId('users-table')).toContainText('张伟')
  await expect(page.getByTestId('user-create')).toHaveAttribute('disabled', '')
  await page.getByTestId('users-table').getByText('张伟').first().click()
  await expect(page.getByTestId('detail-delete')).toHaveAttribute('disabled', '')
  expect(errors).toEqual([])
})

test('viewer 订单管理：仅见本人订单 + 数据权限提示条', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'viewer')
  await page.goto('/#/orders')
  await expect(page.getByTestId('orders-scope-text')).toHaveText('数据权限：仅本人')
  await expect(page.getByTestId('orders-list')).toContainText('华信科技')
  await expect(page.getByTestId('orders-list')).not.toContainText('蓝海贸易')
  expect(errors).toEqual([])
})
