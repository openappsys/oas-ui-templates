// e2e/misc.spec.ts —— 杂项用例（react 版对应段落在 tabs/misc 的壳层用例因 cdn 壳层差异不移植：
// 无多页签/面包屑/命令面板/主题按钮；本文件覆盖数据看板、错误页三件套与个人中心主题预览，
// 断言语义对齐 vanilla/react 版同页面用例）
// 适配点：cdn 主题切换入口在个人中心主题预览卡（react 版为壳层 #theme-toggle 按钮）
import { expect, test } from '@playwright/test'
import { beforeEachMock, login, noConsoleErrors } from './helpers'

beforeEachMock()

test('数据看板：统计卡、三图表与季度目标进度渲染', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/data-board')
  await expect(page.locator('#board-grid .stat-card')).toHaveCount(4)
  await expect(page.getByText('总销售额')).toBeVisible()
  await expect(page.locator('.board-charts oas-chart svg')).toHaveCount(3)
  await expect(page.getByTestId('board-progress-order')).toBeVisible()
  await expect(page.getByTestId('board-progress-revenue')).toBeVisible()
  await expect(page.getByTestId('board-progress-users')).toBeVisible()
  expect(errors).toEqual([])
})

test('错误页三件套：403/404/500 渲染与返回首页', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)

  await page.goto('/#/forbidden')
  await expect(page.locator('.notice-code')).toHaveText('403')
  await page.getByRole('button', { name: '返回首页' }).click()
  await expect(page).toHaveURL(/#\/dashboard/)

  await page.goto('/#/500')
  await expect(page.locator('.notice-code')).toHaveText('500')
  await page.getByRole('button', { name: '返回首页' }).click()
  await expect(page).toHaveURL(/#\/dashboard/)

  // 未知路径 → 守卫语义送 404（vanilla 同款）
  await page.goto('/#/no-such-page')
  await expect(page).toHaveURL(/#\/not-found/)
  await expect(page.locator('.notice-code')).toHaveText('404')
  expect(errors).toEqual([])
})

test('个人中心：会话信息展示 + 主题预览切换 data-theme', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/profile')
  await expect(page.locator('#profile-name')).toHaveText('张伟')

  await page.locator('.theme-preview[data-theme="dark"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('.theme-preview[data-theme="dark"]')).toHaveClass(/is-selected/)

  await page.locator('.theme-preview[data-theme="light"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(errors).toEqual([])
})
