// e2e/forms.spec.ts —— 基础表单 / 高级表单用例（对齐 react/e2e/misc.spec.ts 基础表单段；
// 高级表单为核心流程补齐：必填校验 + 合法填写提交成功）
// MPA 适配：SPA hash 路由 → basic-form.html / advanced-form.html 直达
// 控件适配：oas-form 校验错误为字段旁 light-DOM .error-text（无 oas-form-item 包装时）
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('基础表单：空值提交触发必填校验', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/basic-form.html')
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('#basic-form')).toContainText('请输入项目名称')
  await expect(page.locator('#basic-form')).toContainText('请选择类别')
  expect(errors).toEqual([])
})

test('基础表单：合法填写后提交成功', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/basic-form.html')
  await page.locator('#basic-form oas-input[name="name"]').locator('input').fill('门户改版项目')
  await page.locator('#basic-form oas-select[name="category"]').click()
  await page.getByRole('option', { name: 'Web 应用' }).click()
  await page
    .locator('#basic-form oas-input[name="contact"]')
    .locator('input')
    .fill('pm@example.com')
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('oas-message').filter({ hasText: '提交成功' })).toBeVisible()
  expect(errors).toEqual([])
})

test('高级表单：空值提交触发必填校验', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/advanced-form.html')
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('#advanced-form')).toContainText('请输入公司名称')
  await expect(page.locator('#advanced-form')).toContainText('请输入统一社会信用代码')
  expect(errors).toEqual([])
})

test('高级表单：合法填写后提交成功', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/advanced-form.html')
  await page.locator('#advanced-form oas-input[name="company"]').locator('input').fill('云杉科技')
  await page
    .locator('#advanced-form oas-input[name="creditCode"]')
    .locator('input')
    .fill('91310000MA1K35X79A')
  // oas-combobox：oas-form 取值直读 value 属性，设值 + 派发 oas-change 同步（避免浮层定位竞态）
  await page.locator('#advanced-form oas-combobox[name="category"]').evaluate((el) => {
    el.setAttribute('value', 'electronics')
    el.dispatchEvent(
      new CustomEvent('oas-change', { detail: { value: 'electronics' }, bubbles: true }),
    )
  })
  await page.getByRole('button', { name: '提交登记' }).click()
  await expect(page.locator('oas-message').filter({ hasText: '提交成功' })).toBeVisible()
  expect(errors).toEqual([])
})
