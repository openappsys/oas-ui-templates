import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill('张伟')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

function preset(page: Page, style: string, position: string): void {
  // 预置菜单配置，确保首次挂载即按该形态渲染
  void page.addInitScript(
    ([s, p]) => {
      localStorage.setItem('oas-admin.menu-style', s)
      localStorage.setItem('oas-admin.menu-position', p)
    },
    [style, position] as [string, string],
  )
}

const NAV_TAG: Record<string, string> = {
  sidebar: 'OAS-SIDEBAR',
  menubar: 'OAS-MENUBAR',
  navigation: 'OAS-NAVIGATION-MENU',
}

for (const [style, position] of [
  ['sidebar', 'left'],
  ['sidebar', 'right'],
  ['menubar', 'left'],
  ['menubar', 'top'],
  ['navigation', 'left'],
  ['navigation', 'top'],
] as const) {
  test(`admin 菜单矩阵：${style}+${position} 渲染对应菜单组件`, async ({ page }) => {
    preset(page, style, position)
    await login(page)
    await expect(page.locator('#nav')).toHaveAttribute('id', 'nav')
    const tag = await page.locator('#nav').evaluate((el) => el.tagName)
    expect(tag).toBe(NAV_TAG[style])
    // 布局 side 跟随
    const side = await page.locator('oas-layout').evaluate((el) => el.getAttribute('side'))
    expect(side).toBe(position)
    // top 时菜单组（menubar/navigation）横排，否则竖排；sidebar 无 orientation 属性（天然竖排）
    const orient = await page.locator('#nav').evaluate((el) => el.getAttribute('orientation'))
    if (style === 'sidebar') expect(orient).toBeNull()
    else expect(orient).toBe(position === 'top' ? 'horizontal' : 'vertical')
  })
}

test('admin 菜单矩阵：设置中心可切换形态+位置（实时生效）', async ({ page }) => {
  await login(page)
  await expect(page.locator('#nav')).toHaveAttribute('id', 'nav')
  expect(await page.locator('#nav').evaluate((el) => el.tagName)).toBe('OAS-SIDEBAR')

  // 进设置中心 → 点矩阵「菜单条+顶部」
  await page.goto('/#/settings')
  await expect(page.getByTestId('menu-matrix')).toBeVisible()
  await page.locator('.menu-matrix-cell[data-style="menubar"][data-position="top"]').click()
  await expect(page.locator('#nav')).toHaveAttribute('orientation', 'horizontal')

  // 再切「多级导航 + 左侧」（竖排）
  await page.locator('.menu-matrix-cell[data-style="navigation"][data-position="left"]').click()
  await expect(page.locator('#nav')).toHaveAttribute('orientation', 'vertical')
  expect(await page.locator('#nav').evaluate((el) => el.tagName)).toBe('OAS-NAVIGATION-MENU')

  // 侧边栏 + 顶部应禁用（不可点，8 可选 1 不可选）
  const disabled = await page
    .locator('.menu-matrix-cell[data-style="sidebar"][data-position="top"]')
    .evaluate((el) => el.hasAttribute('disabled'))
  expect(disabled).toBe(true)
})

test('admin 菜单矩阵：菜单条顶部展开下拉并导航', async ({ page }) => {
  preset(page, 'menubar', 'top')
  await login(page)
  // 点「业务」展开下拉
  await page.getByText('业务', { exact: true }).first().click()
  // 点 shadow 内的「订单管理」子项导航
  await page.locator('#nav').evaluateHandle((el) => {
    const nav = el as HTMLElement & { shadowRoot: ShadowRoot }
    const item = [...nav.shadowRoot.querySelectorAll('.subitem')].find((x) =>
      x.textContent?.includes('订单管理'),
    )
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
  })
  await page.waitForTimeout(1200)
  await expect(page).toHaveURL(/#\/orders/)
  await expect(page.getByTestId('orders-export')).toBeVisible()
})
