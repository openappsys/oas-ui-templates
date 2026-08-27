import { message } from '@oas-ui/ui/feedback/message'
import '@oas-ui/ui/form/date-picker'
import '@oas-ui/ui/form/upload'
import { onLocaleChange, t } from '../i18n'

function catOptions(): Array<{ label: string; value: string }> {
  return [
    { label: t('basic.catWeb'), value: 'web' },
    { label: t('basic.catMobile'), value: 'mobile' },
    { label: t('basic.catData'), value: 'data' },
  ]
}

function statusOptions(): Array<{ label: string; value: string }> {
  return [
    { label: t('basic.stDev'), value: 'dev' },
    { label: t('basic.stLive'), value: 'live' },
  ]
}

function rulesJSON(): string {
  return JSON.stringify({
    name: [{ required: true, message: t('basic.ruleName') }],
    category: [{ required: true, message: t('basic.ruleCategory') }],
    contact: [
      { required: true, message: t('basic.ruleEmail') },
      { pattern: '^\\S+@\\S+$', message: t('basic.ruleEmailFmt') },
    ],
  })
}

export function render(el: HTMLElement): () => void {
  function resetForm(form: HTMLElement): void {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.reset()
  }

  function refreshText(): void {
    // 文本节点
    el.querySelector<HTMLElement>('h1.page-title')!.textContent = t('basic.title')
    el.querySelector<HTMLElement>('p.page-subtitle')!.textContent = t('basic.subtitle')
    // 组件属性文案
    el.querySelector<HTMLElement>('oas-card[title]')!.setAttribute('title', t('basic.card'))
    el.querySelector<HTMLElement>('oas-input[name="name"]')?.setAttribute('label', t('basic.name'))
    el.querySelector<HTMLElement>('oas-input[name="name"]')?.setAttribute(
      'placeholder',
      t('basic.name'),
    )
    el.querySelector<HTMLElement>('oas-select[name="category"]')?.setAttribute(
      'label',
      t('basic.category'),
    )
    el.querySelector<HTMLElement>('oas-select[name="category"]')?.setAttribute(
      'placeholder',
      t('basic.category'),
    )
    el.querySelector<HTMLElement>('oas-select[name="category"]')?.setAttribute(
      'options',
      JSON.stringify(catOptions()),
    )
    el.querySelector<HTMLElement>('oas-select[name="status"]')?.setAttribute(
      'label',
      t('basic.status'),
    )
    el.querySelector<HTMLElement>('oas-select[name="status"]')?.setAttribute(
      'placeholder',
      t('basic.status'),
    )
    el.querySelector<HTMLElement>('oas-select[name="status"]')?.setAttribute(
      'options',
      JSON.stringify(statusOptions()),
    )
    el.querySelector<HTMLElement>('oas-input[name="days"]')?.setAttribute('label', t('basic.days'))
    el.querySelector<HTMLElement>('oas-input[name="budget"]')?.setAttribute(
      'label',
      t('basic.budget'),
    )
    el.querySelector<HTMLElement>('oas-input[name="contact"]')?.setAttribute(
      'label',
      t('basic.contact'),
    )
    el.querySelector<HTMLElement>('oas-input[name="contact"]')?.setAttribute(
      'placeholder',
      t('basic.contact'),
    )
    el.querySelector<HTMLElement>('oas-textarea[name="desc"]')?.setAttribute(
      'label',
      t('basic.desc'),
    )
    el.querySelector<HTMLElement>('oas-switch[name="notify"]')?.setAttribute(
      'label',
      t('basic.notify'),
    )
    el.querySelector<HTMLElement>('oas-date-picker[name="due"]')?.setAttribute(
      'label',
      t('basic.days'),
    )
    el.querySelector<HTMLElement>('oas-upload[name="file"]')?.setAttribute(
      'label',
      t('basic.contact'),
    )
    // 按钮插槽文本
    el.querySelector<HTMLElement>('[data-action="submit"]')!.textContent = t('basic.submit')
    el.querySelector<HTMLElement>('[data-action="reset"]')!.textContent = t('basic.reset')
    // 表单校验 rules（含 t() message）
    el.querySelector<HTMLElement>('#basic-form')?.setAttribute('rules', rulesJSON())
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

  return onLocaleChange(refreshText)
}
