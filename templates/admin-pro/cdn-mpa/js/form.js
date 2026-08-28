import { guard } from './session.js'
import { mountShell } from './shell.js'
import { t } from './i18n.js'

if (guard()) {
  const view = mountShell({ active: './form.html' })
  renderForm(view)
}

function renderForm(el) {
  document.title = `${t('nav.form')} · ${t('app.title')}`
  el.innerHTML = `
    <div class="page">
      <h1 class="page-title">${t('nav.form')}</h1>
      <p class="page-subtitle">${t('form.subtitle')}</p>
      <oas-card>
        <oas-form id="basic-form" rules='${JSON.stringify({
          name: [{ required: true, message: t('form.ruleName') }],
        })}'>
          <div class="form-grid">
            <oas-input name="name" label="${t('form.name')}" placeholder="${t('form.name')}"></oas-input>
            <oas-select name="category" label="${t('form.category')}" options='[{"label":"A","value":"a"},{"label":"B","value":"b"}]'></oas-select>
            <oas-switch name="status" label="${t('form.status')}"></oas-switch>
            <oas-date-picker name="due" label="${t('form.due')}"></oas-date-picker>
          </div>
          <oas-textarea name="desc" label="${t('form.desc')}"></oas-textarea>
          <oas-space style="margin-top: var(--oas-space-3)">
            <oas-button type="primary" data-action="submit">${t('form.submit')}</oas-button>
            <oas-button data-action="reset">${t('form.reset')}</oas-button>
          </oas-space>
        </oas-form>
      </oas-card>
    </div>`
  const form = el.querySelector('#basic-form')
  form.addEventListener('oas-submit', () => {
    OASUI.message.success(t('form.submitted'))
  })
  el.querySelector('[data-action="submit"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })
  el.querySelector('[data-action="reset"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.reset()
    window.OASUI?.message?.info?.(t('form.resetDone'))
  })
}
