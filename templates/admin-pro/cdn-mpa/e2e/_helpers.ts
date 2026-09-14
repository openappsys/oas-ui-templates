// e2e/_helpers.ts —— e2e 公共工具：运行时 mock、登录助手、localStorage 写入
// viewer 角色分支说明：cdn-mpa 会话无 role 字段（session.js 仅存 name/loginAt），
// react 版的 viewer 403/操作权限用例在本模版无对应分支，一律跳过不移植。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

const CDN_JS = readFileSync(join(import.meta.dirname, '../node_modules/@oas-ui/ui/dist/cdn.js'))
const THEME_CSS = readFileSync(join(import.meta.dirname, '../node_modules/@oas-ui/theme/index.css'))

// unpkg 运行时引用 → 本地 node_modules 副本（离线稳定；与 smoke.spec.ts 同款约定）
export function mockOasRuntime(page: Page): void {
  page.route('**unpkg.com/@oas-ui/**', (route) => {
    const url = route.request().url()
    if (url.endsWith('.css'))
      return route.fulfill({ body: THEME_CSS, contentType: 'text/css; charset=utf-8' })
    return route.fulfill({ body: CDN_JS, contentType: 'application/javascript; charset=utf-8' })
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
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k as string, v as string),
    [key, value] as const,
  )
}
