// cdn e2e helpers（完整版）：unpkg mock 改 path 回填（2.5.9 大产物）+ 登录 + 控制台错误 + 开关
import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'

/** unpkg 拦截回填 → 本地 node_modules 产物（离线稳定，与 smoke.spec.ts 同约定）。
 *  2.5.9 起用 path 形式回填（body 形式对 2.3MB 大产物存在截断/头缺失风险） */
export async function mockCdnRuntime(page: Page): Promise<void> {
  await page.route('**unpkg.com/@oas-ui/**', (route) => {
    const url = route.request().url()
    const rel = decodeURIComponent(url.split('@oas-ui/')[1].split('?')[0]).replace(
      /^(theme|ui)@[\d.]+\//,
      '$1/',
    )
    route.fulfill({ path: join(import.meta.dirname, '../node_modules/@oas-ui', rel) })
  })
}

/** 收集控制台错误与页面异常（每个用例结尾断言为空） */
export async function noConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

/** 登录进壳层（默认管理员视角「张伟」） */
export async function login(page: Page, name = '张伟'): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill(name)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

/** 预写 localStorage（在首次 goto 前调用） */
export async function setLocal(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [
    key,
    value,
  ] as const)
}

export function beforeEachMock(): void {
  test.beforeEach(async ({ page }) => {
    await mockCdnRuntime(page)
  })
}

/** 侧栏树形导航点击：目标页面项所在分组被 accordion 收起时，先展开分组再点击 */
export async function openNavItem(page: Page, group: string, item: string): Promise<void> {
  const nav = page.locator('#nav')
  const target = nav.getByText(item, { exact: true })
  if (!(await target.isVisible().catch(() => false))) {
    await nav.getByText(group, { exact: true }).first().click()
  }
  await target.click()
}
