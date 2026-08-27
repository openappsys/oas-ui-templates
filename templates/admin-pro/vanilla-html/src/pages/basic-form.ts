import { message } from '@oas-ui/ui/feedback/message'
import '@oas-ui/ui/form/date-picker'
import '@oas-ui/ui/form/upload'
import { onLocaleChange, t } from '../i18n'

export function render(el: HTMLElement): () => void {
  function resetForm(form: HTMLElement): void {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.reset()
  }

  function draw(): void {
    const cat = () => [
      { label: t('basic.catWeb'), value: 'web' },
      { label: t('basic.catMobile'), value: 'mobile' },
      { label: t('basic.catData'), value: 'data' },
    ]
    const status = () => [
      { label: t('basic.stDev'), value: 'dev' },
      { label: t('basic.stLive'), value: 'live' },
    ]
    const rules = JSON.stringify({
      name: [{ required: true, message: t('basic.ruleName') }],
      category: [{ required: true, message: t('basic.ruleCategory') }],
      contact: [
        { required: true, message: t('basic.ruleEmail') },
        { pattern: '^\\S+@\\S+$', message: t('basic.ruleEmailFmt') },
      ],
    })
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div>
            <h1 class="page-title">${t('basic.title')}</h1>
            <p class="page-subtitle">${t('basic.subtitle')}</p>
          </div>
        </div>
        <oas-card class="list-card" title="${t('basic.card')}">
          <oas-form id="basic-form" rules='${rules}'>
            <div class="form-grid form-grid--2col">
              <oas-input name="name" label="${t('basic.name')}" placeholder="${t('basic.name')}"></oas-input>
              <oas-select name="category" label="${t('basic.category')}" options='${JSON.stringify(cat())}' placeholder="${t('basic.category')}"></oas-select>
              <oas-select name="status" label="${t('basic.status')}" options='${JSON.stringify(status())}' placeholder="${t('basic.status')}"></oas-select>
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
    const form = el.querySelector<HTMLElement>('#basic-form')!
    form.addEventListener('oas-submit', () => {
      message.success(t('basic.submitted'))
    })
    el.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      resetForm(form)
      message.info(t('basic.resetDone'))
    })
    el.querySelector('[data-action="submit"]')?.addEventListener('click', () => {
      ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
    })
  }

  draw()
  return onLocaleChange(draw)
}
