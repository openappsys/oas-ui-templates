/**
 * 基础表单页（自 vanilla src/pages/basic-form.ts 去 TS 移植，DOM/类名/testid 对齐）
 * 10 控件 + 必填/邮箱格式校验；reset 为 no-op 怪癖（vanilla 同款，保持不修）
 */
import { onLocaleChange, t } from './i18n.js'

const catOptions = () => [
  { label: t('basic.catWeb'), value: 'web' },
  { label: t('basic.catMobile'), value: 'mobile' },
  { label: t('basic.catData'), value: 'data' },
]

const statusOptions = () => [
  { label: t('basic.stDev'), value: 'dev' },
  { label: t('basic.stLive'), value: 'live' },
]

const rulesJSON = () =>
  JSON.stringify({
    name: [{ required: true, message: t('basic.ruleName') }],
    category: [{ required: true, message: t('basic.ruleCategory') }],
    contact: [
      { required: true, message: t('basic.ruleEmail') },
      { pattern: '^\\S+@\\S+$', message: t('basic.ruleEmailFmt') },
    ],
  })

export function renderBasicForm(el) {
  function resetForm(form) {
    form.shadowRoot?.querySelector('form')?.reset()
  }

  function refreshText() {
    // 文本节点
    el.querySelector('h1.page-title').textContent = t('basic.title')
    el.querySelector('p.page-subtitle').textContent = t('basic.subtitle')
    // 组件属性文案
    el.querySelector('oas-card[title]').setAttribute('title', t('basic.card'))
    el.querySelector('oas-input[name="name"]')?.setAttribute('label', t('basic.name'))
    el.querySelector('oas-input[name="name"]')?.setAttribute('placeholder', t('basic.name'))
    el.querySelector('oas-select[name="category"]')?.setAttribute('label', t('basic.category'))
    el.querySelector('oas-select[name="category"]')?.setAttribute(
      'placeholder',
      t('basic.category'),
    )
    el.querySelector('oas-select[name="category"]')?.setAttribute(
      'options',
      JSON.stringify(catOptions()),
    )
    el.querySelector('oas-select[name="status"]')?.setAttribute('label', t('basic.status'))
    el.querySelector('oas-select[name="status"]')?.setAttribute('placeholder', t('basic.status'))
    el.querySelector('oas-select[name="status"]')?.setAttribute(
      'options',
      JSON.stringify(statusOptions()),
    )
    el.querySelector('oas-input[name="days"]')?.setAttribute('label', t('basic.days'))
    el.querySelector('oas-input[name="budget"]')?.setAttribute('label', t('basic.budget'))
    el.querySelector('oas-input[name="contact"]')?.setAttribute('label', t('basic.contact'))
    el.querySelector('oas-input[name="contact"]')?.setAttribute('placeholder', t('basic.contact'))
    el.querySelector('oas-textarea[name="desc"]')?.setAttribute('label', t('basic.desc'))
    el.querySelector('oas-switch[name="notify"]')?.setAttribute('label', t('basic.notify'))
    el.querySelector('oas-date-picker[name="due"]')?.setAttribute('label', t('basic.days'))
    el.querySelector('oas-upload[name="file"]')?.setAttribute('label', t('basic.contact'))
    // 按钮插槽文本
    el.querySelector('[data-action="submit"]').textContent = t('basic.submit')
    el.querySelector('[data-action="reset"]').textContent = t('basic.reset')
    // 表单校验 rules（含 t() message）
    el.querySelector('#basic-form')?.setAttribute('rules', rulesJSON())
  }

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('basic.title')}</h1>
          <p class="page-subtitle">${t('basic.subtitle')}</p>
        </div>
      </div>
      <oas-card class="list-card" title="${t('basic.card')}">
        <oas-form id="basic-form" rules='${rulesJSON()}'>
          <div class="form-grid form-grid--2col">
            <oas-input name="name" label="${t('basic.name')}" placeholder="${t('basic.name')}"></oas-input>
            <oas-select name="category" label="${t('basic.category')}" options='${JSON.stringify(catOptions())}' placeholder="${t('basic.category')}"></oas-select>
            <oas-select name="status" label="${t('basic.status')}" options='${JSON.stringify(statusOptions())}' placeholder="${t('basic.status')}"></oas-select>
            <oas-input name="days" type="number" label="${t('basic.days')}"></oas-input>
            <oas-input name="budget" type="number" label="${t('basic.budget')}"></oas-input>
            <oas-input name="contact" label="${t('basic.contact')}" placeholder="${t('basic.contact')}"></oas-input>
            <oas-textarea name="desc" label="${t('basic.desc')}"></oas-textarea>
            <oas-switch name="notify" label="${t('basic.notify')}"></oas-switch>
            <oas-date-picker name="due" label="${t('basic.days')}"></oas-date-picker>
            <oas-upload name="file" label="${t('basic.contact')}"></oas-upload>
          </div>
          <oas-space>
            <oas-button type="primary" data-action="submit">${t('basic.submit')}</oas-button>
            <oas-button data-action="reset">${t('basic.reset')}</oas-button>
          </oas-space>
        </oas-form>
      </oas-card>
    </div>`
  const form = el.querySelector('#basic-form')
  form.addEventListener('oas-submit', () => {
    OASUI.message.success(t('basic.submitted'))
  })
  el.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    resetForm(form)
    OASUI.message.info(t('basic.resetDone'))
  })
  el.querySelector('[data-action="submit"]')?.addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  document.title = `${t('nav.basicForm')} · ${t('app.title')}`
  return onLocaleChange(refreshText)
}
