import type { Page } from '@playwright/test'

/**
 * 侧栏树形导航点击：目标页面项所在分组被 accordion 收起时，先展开分组再点击。
 * 目标项可见（所在组已展开）时直接点击。
 */
export async function openNavItem(page: Page, group: string, item: string): Promise<void> {
  const nav = page.locator('#nav')
  const target = nav.getByText(item, { exact: true })
  if (!(await target.isVisible().catch(() => false))) {
    await nav.getByText(group, { exact: true }).first().click()
  }
  await target.click()
}
