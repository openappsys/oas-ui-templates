// 组件内置文案联动回归锁（OASUI.setLocale × 外部 en.js 真实链路）：
// 壳层词典与应用层切换之外，组件内置文案（popconfirm 确定/取消等）此前恒为 zh-CN（已知边界）。
// 现契约：zh 走 cdn.js 内联 registry（同步 setLocale('zh-CN')）；en 动态 import 与 IIFE 同版本的
// 纯数据 @oas-ui/i18n/dist/en.js 后 setLocale(module.default)——成功缓存、失败不永久缓存可重试、
// 慢包返回前已切回中文的迟到结果不得覆盖中文。离线 mock 按真实文件路径回填（i18n ≠ cdn.js）。
import { expect, test, type Page } from '@playwright/test'
import { login, mockCdnRuntime, noConsoleErrors } from './helpers'

// unpkg 运行时引用 → 本地 node_modules 真实文件路径回填（离线稳定；i18n 语言包不能当 cdn.js 回填）。
// 用例内再注册的特定路由（慢包/失败注入）后注册先执行，可 fallback 回到这里按真实文件回填。
test.beforeEach(async ({ page }) => {
  await mockCdnRuntime(page)
})

// 与 i18n.js 的 COMPONENT_VERSION pin 对应的动态 import URL（glob * 不跨 /，版本号安全匹配）
const EN_PACK_URL = '**unpkg.com/@oas-ui/i18n@*/dist/en.js'

/** 打开部门页详情区「删除」气泡确认（真实用户操作路径；hash 直达与语言无关——切换语言后导航文案已换） */
async function openDeptDeletePop(page: Page): Promise<void> {
  await page.goto('/#/system/dept')
  const delBtn = page.locator('[data-md-action="delete"]')
  await delBtn.waitFor()
  await delBtn.click()
  const okBtn = page.locator('#md-del-pop [part="ok"]')
  await expect(okBtn).toBeVisible()
}

test('部门删除 popconfirm：中文 确定/取消 → 英文 OK/Cancel → 切回中文', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('确定')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('取消')

  // 切英文：语言切换触发同文档重渲（面板收起），重开后断言组件内置文案已随语言包跟切
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('OK')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('Cancel')

  // 切回中文：内置 registry 同步回落
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('仪表盘')
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('确定')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('取消')
  // 面板真实可用：点取消收起（可见反馈）
  await page.locator('#md-del-pop [part="cancel"]').click()
  await expect(page.locator('#md-del-pop [part="ok"]')).toBeHidden()
  expect(errors, '全程 console 零告警').toEqual([])
})

test.describe('en-US 首访', () => {
  test.use({ locale: 'en-US' })

  test('登录页与组件内置文案均为英文', async ({ page }) => {
    const errors = await noConsoleErrors(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await login(page)
    await openDeptDeletePop(page)
    await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('OK')
    await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('Cancel')
    expect(errors, 'console 零告警').toEqual([])
  })
})

test('英文状态刷新后语言保持：popconfirm 仍为 OK/Cancel', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('OK')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('Cancel')
  expect(errors, 'console 零告警').toEqual([])
})

test('慢英文包竞态：先切英文再切回中文，迟到结果不得覆盖中文', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  // 注册顺序决定拦截顺序（后注册先执行）：en.js 请求扣住，直到显式放行后 fallback 到真实文件回填
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(EN_PACK_URL, async (route) => {
    await gate
    await route.fallback()
  })
  await login(page)
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('确定')

  // 先切英文（壳层立即英文，语言包被扣住）→ 立即切回中文 → 再放行语言包
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('仪表盘')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  release()
  // 语言包已到达（给迟到应用留窗口），重开面板：中文必须原样保留
  await page.waitForTimeout(600)
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('确定')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('取消')
  // 面板仍真实可用（点取消收起，有可见反馈）
  await page.locator('#md-del-pop [part="cancel"]').click()
  await expect(page.locator('#md-del-pop [part="ok"]')).toBeHidden()
  expect(errors, 'console 零告警').toEqual([])
})

test('语言包加载失败可重试：第一次 404 组件维持中文，重试成功切英文', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  let attempts = 0
  await page.route(EN_PACK_URL, async (route) => {
    attempts += 1
    if (attempts === 1) return route.fulfill({ status: 404, body: 'not found' })
    return route.fallback()
  })
  await login(page)
  await openDeptDeletePop(page)

  // 第一次切英文：语言包 404 → 组件内置文案维持中文（不抛页面异常）
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await page.waitForTimeout(400)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('确定')
  expect(attempts, '失败的首载').toBe(1)

  // 切回中文再切英文：第二次真实加载成功 → 重开面板断言组件内置文案已切英文
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('仪表盘')
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('OK')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('Cancel')
  // 失败不永久缓存：确有第二次真实请求
  expect(attempts).toBe(2)
  // 除人为 404 的资源加载错误外，console 零告警、无 pageerror
  // （Chromium 记 "Failed to load resource"；Firefox 对无 CORS 头的失败模块请求记 Cross-Origin Request Blocked）
  const intentional = (e: string) =>
    e.includes('Failed to load resource') || e.includes('Cross-Origin Request Blocked')
  expect(
    errors.filter((e) => !intentional(e)),
    '除人为 404 外 console 零告警',
  ).toEqual([])
})
