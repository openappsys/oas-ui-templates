import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t } from './i18n.js'

function boot() {
  document.title = `${t('basic.title')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './basic-form.html' })
  // 面包屑：示例 → 基础表单（对齐 vanilla：basic-form 挂在示例组）
  window.OASShell.setBreadcrumb([
    { label: 'nav.group.demo', href: './basic-form.html' },
    { label: 'basic.title' },
  ])
  renderBasicForm()
}

// 登录守卫 + 启动渲染（置于模块末尾，避免 TDZ）

function catOptions() {
  return [
    { label: t('basic.catWeb'), value: 'web' },
    { label: t('basic.catMobile'), value: 'mobile' },
    { label: t('basic.catData'), value: 'data' },
  ]
}

function statusOptions() {
  return [
    { label: t('basic.stDev'), value: 'dev' },
    { label: t('basic.stLive'), value: 'live' },
  ]
}

function rulesJSON() {
  return JSON.stringify({
    name: [{ required: true, message: t('basic.ruleName') }],
    category: [{ required: true, message: t('basic.ruleCategory') }],
    contact: [
      { required: true, message: t('basic.ruleEmail') },
      { pattern: '^\\S+@\\S+$', message: t('basic.ruleEmailFmt') },
    ],
  })
}

function renderBasicForm() {
  const form = document.querySelector('#basic-form')

  // select options 随 locale 灌（HTML 静态无法表达 t() 文案）
  form
    .querySelector('oas-select[name="category"]')
    .setAttribute('options', JSON.stringify(catOptions()))
  form
    .querySelector('oas-select[name="status"]')
    .setAttribute('options', JSON.stringify(statusOptions()))
  form.setAttribute('rules', rulesJSON())

  form.addEventListener('oas-submit', () => {
    OASUI.message.success(t('basic.submitted'))
  })

  // 重置：调 oas-form 内部原生 form 的 reset（对齐 vanilla 同款调用；组件行为保持一致）
  document.querySelector('[data-action="reset"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.reset()
    OASUI.message.info(t('basic.resetDone'))
  })

  document.querySelector('[data-action="submit"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })
}

if (guard()) boot()
