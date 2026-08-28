import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t } from './i18n.js'

if (guard()) {
  document.title = `${t('nav.form')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './form.html' })

  const form = document.querySelector('#basic-form')
  // rules 是配置（且校验文案随 locale），由 JS 灌；静态结构在 form.html
  form.setAttribute(
    'rules',
    JSON.stringify({ name: [{ required: true, message: t('form.ruleName') }] }),
  )
  form.addEventListener('oas-submit', () => {
    OASUI.message.success(t('form.submitted'))
  })
  document.querySelector('[data-action="submit"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })
  document.querySelector('[data-action="reset"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.reset()
    window.OASUI?.message?.info?.(t('form.resetDone'))
  })
}
