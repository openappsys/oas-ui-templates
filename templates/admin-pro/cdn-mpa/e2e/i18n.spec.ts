// 组件内置文案联动回归锁（MPA：写 storage + reload 语义）：
// 组件内置文案（popconfirm 确定/取消等）此前恒为 zh-CN（已知边界）。现契约：页面加载即按当前
// locale 对齐 cdn.js 内联 registry——zh 同步 setLocale('zh-CN')；en 动态 import 与 IIFE 同版本的
// 纯数据 @oas-ui/i18n/dist/en.js 后 setLocale(module.default)。切语言 = 写 storage + reload，
// 壳层 setLocale 保持同步；语言包到达前组件短暂保持 zh-CN，到达即广播刷新。
import { expect, test, type Page } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

// unpkg 运行时引用 → 本地 node_modules 真实文件路径回填（离线稳定；i18n 语言包不能当 cdn.js 回填）
test.beforeEach(async ({ page }) => {
  mockOasRuntime(page)
})

/** 打开部门页详情区「删除」气泡确认（真实用户操作路径；数据加载后详情区默认选中首个部门） */
async function openDeptDeletePop(page: Page): Promise<void> {
  await page.goto('./dept.html')
  const delBtn = page.locator('[data-md-action="delete"]')
  await delBtn.waitFor()
  await delBtn.click()
  const okBtn = page.locator('#md-del-pop [part="ok"]')
  await expect(okBtn).toBeVisible()
}

test('部门删除 popconfirm：中文 确定/取消 → 切英文（reload）→ OK/Cancel → 切回中文', async ({
  page,
}) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('确定')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('取消')

  // 切英文 = setLocale + 整页 reload（click 自动等待导航完成）
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('OK')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('Cancel')

  // 切回中文
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('仪表盘')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('确定')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('取消')
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
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('OK')
  // MPA 无 live 切换：刷新后按 storage 重放英文
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await openDeptDeletePop(page)
  await expect(page.locator('#md-del-pop [part="ok"]')).toHaveText('OK')
  await expect(page.locator('#md-del-pop [part="cancel"]')).toHaveText('Cancel')
  expect(errors, 'console 零告警').toEqual([])
})
