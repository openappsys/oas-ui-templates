// e2e/settings.spec.ts —— 设置中心用例（移植自 react/e2e/settings.spec.ts，断言语义逐条对齐）
// MPA 适配：
// - localStorage 键前缀 oas-admin-cdn-mpa.*
// - 「关闭多页签栏立即生效」：MPA 无多页签容器（settings.js 仅持久化配置），
//   断言收敛为 localStorage 写入 + reload 后开关状态保持
// - viewer 可访问设置中心用例跳过（本模版会话无 role）
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('设置中心：数据与列表/外观偏好写入 localStorage', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/settings.html')
  // 表单呈现方式在「数据与列表」tab
  await page.getByTestId('settings-tabs').getByText('数据与列表', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'data')
  await page.getByTestId('form-mode-group').getByText('对话框').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.form-mode'))).toBe(
    'dialog',
  )
  // 密度与字号在「外观」tab
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'appearance')
  await page.getByTestId('density-group').getByText('紧凑').click()
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.settings.table-density')),
  ).toBe('compact')
  await page.getByTestId('font-size-group').getByText('特大').click()
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.settings.font-size')),
  ).toBe('xl')
  expect(errors).toEqual([])
})

test('设置中心：多页签栏开关持久化，reload 后状态保持', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/settings.html')
  // 多页签栏在「布局与导航」tab；MPA 无页签容器，仅持久化配置（settings.js 注释口径）
  await page.getByTestId('settings-tabs').getByText('布局与导航', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'layout')
  await page.getByTestId('tabs-bar-toggle').click()
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.settings.tabs-bar')),
  ).toBe('false')
  await expect(page.getByTestId('tabs-bar-toggle')).not.toHaveAttribute('checked')

  await page.reload()
  await page.getByTestId('settings-tabs').getByText('布局与导航', { exact: true }).click()
  await expect(page.getByTestId('tabs-bar-toggle')).not.toHaveAttribute('checked')
  await page.getByTestId('tabs-bar-toggle').click()
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.settings.tabs-bar')),
  ).toBe('true')
  await expect(page.getByTestId('tabs-bar-toggle')).toHaveAttribute('checked', '')
  expect(errors).toEqual([])
})

test('设置中心：字号较大档位写入 localStorage 且 reload 后保持选中', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/settings.html')
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'appearance')
  await page.getByTestId('font-size-group').getByText('较大').click()
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.settings.font-size')),
  ).toBe('lg')
  await page.reload()
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'appearance')
  await expect(page.locator('#font-size-group oas-radio[checked]')).toContainText('较大')
  await page.getByTestId('font-size-group').getByText('特大').click()
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.settings.font-size')),
  ).toBe('xl')
  expect(errors).toEqual([])
})

test('设置中心：外观页主题色即时作用于 --oas-color-primary', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/settings.html')
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
  await login(page)
  await page.goto('/settings.html')
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
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.settings.theme.light')),
  ).toBe('#7c3aed')

  // 切到深色：dark 未设置，light 存储保留（独立存储，互不覆盖）
  await page.locator('html').evaluate(() => {
    document.documentElement.dataset.theme = 'dark'
    document.dispatchEvent(new Event('themechange'))
  })
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.settings.theme.light')),
  ).toBe('#7c3aed')
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.settings.theme.dark')),
  ).toBeNull()
  expect(errors).toEqual([])
})

// 归并自 vanilla profile.spec.ts 皮肤用例：切皮肤 → data-skin 写入 html + inline 主色清除
// + 刷新持久化 → 回默认 data-skin 移除（oas-skin 皮肤预设层；启动重放在 fouc.js）
test('设置中心：皮肤切换写 data-skin、清 inline 主色并持久化（oas-skin）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/settings.html')
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()
  await page.getByTestId('skin-group').getByText('堇紫').click()
  // data-skin 写入 html，皮肤接管品牌色族（violet 主色）
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'violet')
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue('--oas-color-primary')),
    )
    .toBe('')
  // 刷新持久化：data-skin 由 fouc.js 启动重放
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'violet')
  // 切回默认：data-skin 移除
  await page.getByTestId('settings-tabs').getByText('外观', { exact: true }).click()
  await page.getByTestId('skin-group').getByText('默认').click()
  await expect(page.locator('html')).not.toHaveAttribute('data-skin')
  expect(errors).toEqual([])
})
