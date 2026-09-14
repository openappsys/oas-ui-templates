/**
 * e2e 共享工具：unpkg 运行时拦截 / 登录 / 控制台错误收集
 * 各 spec 文件引用，smoke.spec.ts 保持自包含不动
 */
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CDN_JS = readFileSync(join(import.meta.dirname, '../node_modules/@oas-ui/ui/dist/cdn.js'))
const THEME_CSS = readFileSync(join(import.meta.dirname, '../node_modules/@oas-ui/theme/index.css'))

/** unpkg 运行时引用 → 本地 node_modules 副本（离线稳定，与 smoke.spec.ts 同款） */
export async function mockCdnRuntime(page: Page): Promise<void> {
  await page.route('**unpkg.com/@oas-ui/**', (route) => {
    const url = route.request().url()
    if (url.endsWith('.css'))
      return route.fulfill({ body: THEME_CSS, contentType: 'text/css; charset=utf-8' })
    return route.fulfill({ body: CDN_JS, contentType: 'application/javascript; charset=utf-8' })
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

/**
 * 登录进壳层（默认管理员视角「张伟」）。
 * cdn 会话无角色系统（登录仅存用户名，无 role 字段）——react 版 viewer 分支
 * 用例（403 / 操作权限 / 数据权限）不移植，见各 spec 文件头注释。
 */
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

/** 既有 smoke 用例之外的新增用例统一挂 unpkg 拦截 */
export function beforeEachMock(): void {
  test.beforeEach(async ({ page }) => {
    await mockCdnRuntime(page)
  })
}
