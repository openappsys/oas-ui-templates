// e2e/forms.spec.ts —— 表单页与结果页用例（对齐 react/e2e/form.spec.ts + misc.spec.ts 基础表单段
// 的断言语义）：基础表单必填校验、高级表单校验与提交、结果页成功/失败态与 sessionStorage 清理
// 适配点：/form 为三步订单向导（pages-form.js，对齐 vanilla form.ts），其全流程
// 由 smoke.spec.ts 与 dev 冒烟覆盖；本文件聚焦 /basic-form（哈希直访）、/advanced-form
// 与「高级表单提交 → /result 成功态」链路
import { expect, test } from '@playwright/test'
import { beforeEachMock, login, noConsoleErrors } from './helpers'

beforeEachMock()

test('基础表单：空值提交触发必填校验', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/basic-form')
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('#basic-form')).toContainText('请输入项目名称')
  expect(errors).toEqual([])
})

test('高级表单：空值提交拦截并展示全部必填错误', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/advanced-form')
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('#advanced-form')).toContainText('请输入公司名称')
  await expect(page.locator('#advanced-form')).toContainText('请输入统一社会信用代码')
  await expect(page.locator('#advanced-form')).toContainText('请选择主营类目')
  await expect(page).toHaveURL(/#\/advanced-form/)
  expect(errors).toEqual([])
})

test('高级表单：填写必填项后提交成功', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/advanced-form')

  await page.locator('#advanced-form oas-input[name="company"]').locator('input').fill('测试供应商')
  await page
    .locator('#advanced-form oas-input[name="creditCode"]')
    .locator('input')
    .fill('91330106MA27X8LT0A')
  // combobox 走 value 属性 + change 事件通道（组件受控模式，与设置中心主题色用例同款）
  await page.locator('#advanced-form oas-combobox[name="category"]').evaluate((el) => {
    el.setAttribute('value', 'electronics')
    el.dispatchEvent(
      new CustomEvent('oas-change', { detail: { value: 'electronics' }, bubbles: true }),
    )
  })

  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('oas-message').filter({ hasText: '提交成功' })).toBeVisible()
  expect(errors).toEqual([])
})

test('结果页：默认失败态（无提交数据）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/result')
  await expect(page.getByTestId('form-result')).toHaveAttribute('status', 'error')
  await expect(page.getByTestId('form-result')).toContainText('演示失败态')
  expect(errors).toEqual([])
})

test('结果页：sessionStorage 成功态渲染后即清理', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.evaluate(() =>
    sessionStorage.setItem(
      'form-result',
      JSON.stringify({ status: 'success', orderId: 'SO-10001' }),
    ),
  )
  await page.goto('/#/result')
  await expect(page.getByTestId('form-result')).toHaveAttribute('status', 'success')
  await expect(page.getByTestId('form-result')).toContainText('创建成功')
  expect(await page.evaluate(() => sessionStorage.getItem('form-result'))).toBeNull()
  expect(errors).toEqual([])
})
