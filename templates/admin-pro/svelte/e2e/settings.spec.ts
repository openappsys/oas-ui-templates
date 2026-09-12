// e2e/settings.spec.ts —— 设置中心用例（移植自 react/e2e/settings.spec.ts，断言语义逐条对齐）
// Svelte 适配记录：oas-radio 的 checked 为布尔存在性 attribute（{cond ? '' : null}），
// react 版 `oas-radio[checked]` 存在性选择器逐字可用；主题色明暗独立存储联动经
// document 'themechange' 事件（svelte 版 appearance-tab 同样监听），用例写法不变
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

test('设置中心：通用页切换表单呈现方式写入 localStorage', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('设置中心').click()
  // 表单呈现方式在「数据与列表」tab
  await page.getByTestId('settings-tabs').getByText('数据与列表', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'data')
  await page.getByTestId('form-mode-group').getByText('对话框').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.form-mode'))).toBe('dialog')
  // 密度与字号在「外观」tab
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'appearance')
  await page.getByTestId('density-group').getByText('紧凑').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.table-density'))).toBe(
    'compact',
  )
  await page.getByTestId('font-size-group').getByText('特大').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.font-size'))).toBe('xl')
  expect(errors).toEqual([])
})

test('设置中心：关闭多页签栏立即生效，再开启恢复', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')

  await page.locator('#nav').getByText('商品管理').click()
  await expect(page.locator('#page-tabs')).toBeVisible()

  await page.locator('#nav').getByText('设置中心').click()
  // 多页签栏在「布局与导航」tab
  await page.getByTestId('settings-tabs').getByText('布局与导航', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'layout')
  await page.getByTestId('tabs-bar-toggle').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.tabs-bar'))).toBe(
    'false',
  )
  await expect(page.locator('.tabs-bar')).toBeHidden()

  await page.locator('#nav').getByText('商品管理').click()
  await expect(page.locator('.tabs-bar')).toBeHidden()
  await expect(page.locator('#view')).toContainText('商品管理')

  await page.locator('#nav').getByText('设置中心').click()
  await page.getByTestId('settings-tabs').getByText('布局与导航', { exact: true }).click()
  await page.getByTestId('tabs-bar-toggle').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.tabs-bar'))).toBe(
    'true',
  )
  await expect(page.locator('.tabs-bar')).toBeVisible()

  expect(errors).toEqual([])
})

test('设置中心：字号较大档位写入 localStorage 且 reload 后保持选中', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('设置中心').click()
  // 字号在「外观」tab
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'appearance')
  await page.getByTestId('font-size-group').getByText('较大').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.font-size'))).toBe('lg')
  await page.reload()
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'appearance')
  await expect(page.locator('#font-size-group oas-radio[checked]')).toContainText('较大')
  await page.getByTestId('font-size-group').getByText('特大').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.font-size'))).toBe('xl')
  expect(errors).toEqual([])
})

test('设置中心：外观页主题色即时作用于 --oas-color-primary', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('设置中心').click()
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()
  const picker = page.getByTestId('appearance-color')
  await picker.locator('[part="trigger"]').click()
  await picker.locator('[part="preset"]').nth(1).click()
  const primary = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--oas-color-primary'),
  )
  expect(primary).toMatch(/^#[0-9a-f]{6}$/i)
  expect(errors).toEqual([])
})

test('设置中心：主题色按明暗主题独立存储并联动生效', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/settings')
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()

  // 浅色主题下设主题色 → 存到 .theme.light
  await page.locator('html').evaluate(() => {
    document.documentElement.dataset.theme = 'light'
  })
  const picker = page.getByTestId('appearance-color')
  await picker.evaluate((el: HTMLElement) => {
    el.setAttribute('value', '#7c3aed')
    el.dispatchEvent(new CustomEvent('oas-change', { detail: { value: '#7c3aed' }, bubbles: true }))
  })
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.theme.light'))).toBe(
    '#7c3aed',
  )

  // 切到深色：dark 未设置，light 存储保留（独立存储，互不覆盖）
  await page.locator('html').evaluate(() => {
    document.documentElement.dataset.theme = 'dark'
    document.dispatchEvent(new Event('themechange'))
  })
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.theme.light'))).toBe(
    '#7c3aed',
  )
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin.settings.theme.dark')),
  ).toBeNull()
  expect(errors).toEqual([])
})

test('viewer 可访问设置中心（不限角色）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '李四', 'viewer')
  await page.goto('/#/settings')
  await expect(page.getByTestId('settings-tabs')).toBeVisible()
  expect(errors).toEqual([])
})
