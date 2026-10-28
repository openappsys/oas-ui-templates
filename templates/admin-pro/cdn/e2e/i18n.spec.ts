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

// 与 i18n.js 的 EN_PACK_URL pin 对应的动态 import URL 模式（glob * 不跨 /，版本号安全匹配）
const EN_PACK_URL = '**unpkg.com/@oas-ui/i18n@*/dist/en.js'

/** 页面内等待语言包模块「响应完成 + 求值完成 + 应用侧既有续体执行完毕」：
 *  同 URL 动态 import 命中同一模块记录——本 await 的 resolve 严格晚于应用侧先注册的续体，
 *  之后的断言不存在竞态窗口（不得用固定 timeout 冒充）。URL 从 performance 资源条目取真实值。 */
async function waitForEnPackSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const findUrl = () =>
      (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .map((r) => r.name)
        .find((n) => n.includes('/@oas-ui/i18n@'))
    let url = findUrl()
    for (let i = 0; i < 200 && !url; i++) {
      await new Promise((r) => setTimeout(r, 25))
      url = findUrl()
    }
    if (!url) throw new Error('en.js 资源未在 performance 中登记')
    await import(url)
  })
}

/** 打开部门页详情区「删除」气泡确认（真实用户操作路径；hash 直达与语言无关——切换语言后导航文案已换） */
async function openDeptDeletePop(page: Page): Promise<void> {
  await page.goto('/#/system/dept')
  const delBtn = page.locator('[data-md-action="delete"]')
  await delBtn.waitFor()
  await delBtn.click()
  const okBtn = page.locator('#md-del-pop [part="ok"]')
  await expect(okBtn).toBeVisible()
}

test('部门删除 popconfirm：中文 确定/取消 → 英文 OK/Cancel → 切回中文（en.js 全程仅请求 1 次）', async ({
  page,
}) => {
  const errors = await noConsoleErrors(page)
  // 成功缓存断言：en→zh→en 二次切英文不得再发语言包请求（精确匹配 en.js 模块，不含其相对 locales/en.js）
  let enPackRequests = 0
  page.on('request', (r) => {
    if (/\/@oas-ui\/i18n@[\d.]+\/dist\/en\.js$/.test(r.url())) enPackRequests += 1
  })
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

  // 二次切英文：成功 Promise 缓存生效——零新增请求，组件文案仍跟切
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('OK')
  expect(enPackRequests, '语言包成功后二次切换不得再请求').toBe(1)
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
  // 条件等待（非固定 timeout）：语言包响应完成 + 模块求值完成 + 应用侧迟到续体已执行。
  // 同 URL import 命中同一模块记录，该 await 的 resolve 严格晚于应用续体——此后断言无竞态窗口。
  await waitForEnPackSettled(page)
  // 重开面板断言：中文必须原样保留（迟到结果被 locale gate 丢弃）
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('确定')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('取消')
  // 面板仍真实可用（点取消收起，有可见反馈）
  await page.locator('#md-del-pop [part="cancel"]').click()
  await expect(page.locator('#md-del-pop [part="ok"]')).toBeHidden()
  expect(errors, 'console 零告警').toEqual([])
})

test('语言包加载失败可重试：第一次 404 组件维持中文，重试成功切英文', async ({ page }) => {
  // 富化采集：console error 带来源 URL，pageerror 独立零容忍
  const consoleErrors: { text: string; url: string }[] = []
  const pageErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error')
      consoleErrors.push({ text: msg.text(), url: msg.location()?.url ?? '' })
  })
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  let attempts = 0
  let firstEnUrl = ''
  page.on('request', (r) => {
    if (/\/@oas-ui\/i18n@[\d.]+\/dist\/en\.js$/.test(r.url())) {
      attempts += 1
      if (!firstEnUrl) firstEnUrl = r.url()
    }
  })
  await page.route(EN_PACK_URL, async (route) => {
    if (attempts === 1) return route.fulfill({ status: 404, body: 'not found' })
    return route.fallback()
  })
  await login(page)
  await openDeptDeletePop(page)

  // 第一次切英文：语言包 404（条件等待「404 响应或请求失败」——Firefox 将拦截呈现为 requestfailed）
  const enSettledFailed = Promise.race([
    page.waitForResponse(
      (r) => /\/@oas-ui\/i18n@[\d.]+\/dist\/en\.js$/.test(r.url()) && r.status() === 404,
    ),
    page.waitForEvent('requestfailed', (r) =>
      /\/@oas-ui\/i18n@[\d.]+\/dist\/en\.js$/.test(r.url()),
    ),
  ])
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await enSettledFailed
  await page.evaluate(() => Promise.resolve())
  // 失败模块不入缓存 → 无同 URL 模块记录可等待；失败后续体已执行，组件内置文案维持中文
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('确定')
  expect(attempts, '失败的首载').toBe(1)

  // 切回中文再切英文：第二次真实加载成功 → 条件等待模块求值完成后重开面板断言英文
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('仪表盘')
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await waitForEnPackSettled(page)
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('OK')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('Cancel')
  // 失败不永久缓存：确有第二次真实请求
  expect(attempts).toBe(2)
  // 豁免判定（AND 三条件，缺一不可）：
  //   ① 来源 URL 精确等于真实 en.js 请求（不是文本包含）；
  //   ② 文本匹配人为失败的两引擎预期形态之一（Chromium "Failed to load resource … 404" /
  //      Firefox "Cross-Origin Request Blocked"）；
  //   ③ 豁免数量恰好 1——同 URL 的其他文本、额外错误一律保留进 unexpected 并失败。
  // 豁免判定（按引擎预期形态，URL 精确性两种口径均钉死）：
  //   Chromium：location.url 精确等于 en.js 请求 URL，且文本为 "Failed to load resource … 404"；
  //   Firefox：拦截条目无资源 URL 归因，文本内嵌完整 en.js URL 且为 "Cross-Origin Request Blocked"。
  // 文本嵌 URL 但来源/形态不符的一律不豁免；豁免数量必须恰好 1。
  const isExpectedInjected404 = (e: { text: string; url: string }): boolean =>
    firstEnUrl !== '' &&
    ((e.url === firstEnUrl && /Failed to load resource.*404/.test(e.text)) ||
      (/Cross-Origin Request Blocked/.test(e.text) && e.text.includes(firstEnUrl)))
  const exempted = consoleErrors.filter((e) => isExpectedInjected404(e))
  const unexpected = consoleErrors.filter((e) => !exempted.includes(e))
  expect(exempted.length, '人为 404 的豁免必须恰好 1 条').toBe(1)
  expect(unexpected, '除人为 404 外 console 零告警（同 URL 其他文本/额外错误不被吞）').toEqual([])
  // 内嵌反证：文本嵌 en.js URL 但来源 URL 字段不符的错误不满足豁免判定
  // （证明额外同 URL 异常不会被吞——豁免不是按「文本包含 URL」单条件放行）
  const synthetic = {
    text: `Failed to load resource: the server responded with a status of 404 (Not Found) — ${firstEnUrl}`,
    url: 'http://localhost:5190/not-the-en-pack',
  }
  expect(isExpectedInjected404(synthetic), '来源不符的错误不得被豁免').toBe(false)
  // pageerror 零容忍
  expect(pageErrors, 'pageerror 零容忍').toEqual([])
})
