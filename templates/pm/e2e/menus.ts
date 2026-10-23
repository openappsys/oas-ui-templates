import { expect, type Page } from '@playwright/test'

/**
 * 顶栏菜单 helpers。
 * 主题/语言/筛选位置/关于收在 oas-dropdown（设置）；身份切换/登出收在用户菜单。
 * 菜单项由组件在内层 oas-menu 的 shadow 里渲染，宿主 testid 挂在数据载体上（display:none），
 * 所以点击走 role（menuitem / menuitemradio）+ 可访问名，而不是 testid。
 */

export const settingsMenu = (page: Page) => page.getByTestId('settings-menu')
export const userMenu = (page: Page) => page.getByTestId('user-menu')

/** 打开设置菜单（齿轮触发器） */
export async function openSettings(page: Page): Promise<void> {
  await page.getByTestId('settings-trigger').click()
  await expect(settingsMenu(page)).toHaveAttribute('open', /.*/, { timeout: 10_000 })
}

/** 动作项（kind=action → role=menuitem）：主题 / 语言 / 关于 */
export const settingsAction = (page: Page, name: string | RegExp) =>
  settingsMenu(page).getByRole('menuitem', { name })

/** 单选组项（role=menuitemradio）：筛选位置三档 */
export const settingsRadio = (page: Page, name: string | RegExp) =>
  settingsMenu(page).getByRole('menuitemradio', { name })

/** Esc 收起设置菜单（hide-on-click=false：主题/语言/筛选位置选完不自动关） */
export async function closeSettings(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(settingsMenu(page)).not.toHaveAttribute('open', /.*/, { timeout: 5_000 })
}

/** 打开用户菜单（头像 + 姓名） */
export async function openUserMenu(page: Page): Promise<void> {
  await page.getByTestId('tb-user').click()
  await expect(userMenu(page)).toHaveAttribute('open', /.*/, { timeout: 10_000 })
}

export const userMenuItem = (page: Page, name: string | RegExp) =>
  userMenu(page).getByRole('menuitem', { name })
