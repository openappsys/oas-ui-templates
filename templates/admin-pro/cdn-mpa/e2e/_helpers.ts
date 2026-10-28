// e2e/_helpers.ts —— e2e 公共工具：运行时 mock、登录助手、localStorage 写入
// viewer 角色分支说明：登录页角色选择已上线（session 存 name/role/loginAt），
// 但既有用例仍按 admin 全量断言编写，viewer 只读路径由 smoke 验证覆盖。
import { join } from 'node:path'
import type { Page } from '@playwright/test'

// unpkg 运行时引用 → 本地 node_modules 真实文件路径回填（离线稳定）。
// path 形式按扩展名推断 MIME；i18n 语言包（dist/en.js + 相对 locales/en.js）必须
// 按真实路径回填——不能把所有请求都当 cdn.js（否则 module.default 不存在，切英文静默失效）。
export function mockOasRuntime(page: Page): void {
  page.route('**unpkg.com/@oas-ui/**', (route) => {
    const url = route.request().url()
    const rel = decodeURIComponent(url.split('@oas-ui/')[1].split('?')[0]).replace(
      /^(theme|ui|i18n)@[\d.]+\//,
      '$1/',
    )
    route.fulfill({ path: join(import.meta.dirname, '../node_modules/@oas-ui', rel) })
  })
}

export async function noConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

// 登录 → dashboard.html（MPA 真实导航；会话落在 localStorage，后续 page.goto 可直达任意页）
export async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill('张伟')
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/dashboard\.html/)
  await page.getByTestId('stat-visits').waitFor()
}

// 登录后写入 localStorage（MPA 页面脚本在导航时读取，需在 goto 前设置）
export async function setLocal(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [
    key,
    value,
  ] as const)
}

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
