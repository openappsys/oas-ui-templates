import { message } from '@oas-ui/ui/feedback/message'
import { onLocaleChange, t } from '../i18n'
import { advFormData } from '../data/adv-form'
import '../styles/pages/advanced-form.css'

function catOptions(): Array<{ label: string; value: string }> {
  return [
    { label: t('adv.cat.electronics'), value: 'electronics' },
    { label: t('adv.cat.packaging'), value: 'packaging' },
    { label: t('adv.cat.chemical'), value: 'chemical' },
    { label: t('adv.cat.hardware'), value: 'hardware' },
  ]
}

function channelOptions(): Array<{ key: string; label: string }> {
  return [
    { key: 'online', label: t('adv.channel.online') },
    { key: 'site', label: t('adv.channel.site') },
    { key: 'jd', label: t('adv.channel.jd') },
    { key: 'offline', label: t('adv.channel.offline') },
    { key: 'dealer', label: t('adv.channel.dealer') },
  ]
}

function rulesJSON(): string {
  return JSON.stringify({
    company: [{ required: true, message: t('adv.ruleCompany') }],
    creditCode: [
      { required: true, message: t('adv.ruleCode') },
      { pattern: '^[0-9A-Z]{18}$', message: t('adv.ruleCodeFmt') },
    ],
    category: [{ required: true, message: t('adv.ruleCategory') }],
  })
}

export function render(el: HTMLElement): () => void {
  let formValues: Record<string, string> = {}
  const manual: Record<string, unknown> = {}

  function resetForm(form: HTMLElement): void {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.reset()
    for (const k of Object.keys(manual)) manual[k] = undefined
  }

  const ITEM_KEYS = [
    'adv.company',
    'adv.creditCode',
    'adv.founded',
    'adv.staff',
    'adv.phone',
    'adv.address',
    'adv.pinLabel',
    'adv.email',
    'adv.category',
    'adv.rating',
    'adv.tags',
    'adv.region',
    'adv.channels',
    'adv.notify',
  ]

  function refreshText(): void {
    const data = advFormData()
    el.querySelector<HTMLElement>('h1.page-title')!.textContent = t('adv.title')
    el.querySelector<HTMLElement>('p.page-subtitle')!.textContent = t('adv.subtitle')
    const cards = el.querySelectorAll<HTMLElement>('.adv-card')
    cards[0]?.setAttribute('title', t('adv.basic'))
    cards[1]?.setAttribute('title', t('adv.contact'))
    cards[2]?.setAttribute('title', t('adv.biztitle'))
    cards[3]?.setAttribute('title', t('adv.coop'))
    const items = el.querySelectorAll<HTMLElement>('oas-form-item')
    items.forEach((item, i) => {
      const key = ITEM_KEYS[i]
      if (key) item.setAttribute('label', t(key))
    })
    el.querySelector<HTMLElement>('oas-input[name="company"]')?.setAttribute(
      'placeholder',
      t('adv.companyPh'),
    )
    el.querySelector<HTMLElement>('oas-input[name="creditCode"]')?.setAttribute(
      'placeholder',
      t('adv.creditCodePh'),
    )
    el.querySelector<HTMLElement>('oas-date-picker')?.setAttribute(
      'placeholder',
      t('adv.foundedPh'),
    )
    el.querySelector<HTMLElement>('oas-auto-complete')?.setAttribute(
      'placeholder',
      t('adv.phonePh'),
    )
    el.querySelector<HTMLElement>('oas-cascader')?.setAttribute('placeholder', t('adv.addressPh'))
    el.querySelector<HTMLElement>('oas-input[name="email"]')?.setAttribute(
      'placeholder',
      t('adv.emailPh'),
    )
    el.querySelector<HTMLElement>('oas-combobox')?.setAttribute('placeholder', t('adv.categoryPh'))
    el.querySelector<HTMLElement>('oas-combobox')?.setAttribute(
      'options',
      JSON.stringify(catOptions()),
    )
    el.querySelector<HTMLElement>('oas-dynamic-tags')?.setAttribute('placeholder', t('adv.tagsPh'))
    el.querySelector<HTMLElement>('oas-tree-select')?.setAttribute('placeholder', t('adv.regionPh'))
    el.querySelector<HTMLElement>('oas-transfer')?.setAttribute(
      'data',
      JSON.stringify(channelOptions()),
    )
    el.querySelector<HTMLElement>('oas-auto-complete')?.setAttribute(
      'options',
      JSON.stringify(data.phones),
    )
    el.querySelector<HTMLElement>('oas-cascader')?.setAttribute(
      'options',
      JSON.stringify(data.regions),
    )
    el.querySelector<HTMLElement>('oas-tree-select')?.setAttribute(
      'options',
      JSON.stringify(data.treeRegions),
    )
    el.querySelector<HTMLElement>('[data-action="submit"]')!.textContent = t('adv.submit')
    el.querySelector<HTMLElement>('[data-action="reset"]')!.textContent = t('basic.reset')
    el.querySelector<HTMLElement>('#advanced-form')?.setAttribute('rules', rulesJSON())
  }

  const data = advFormData()
  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('adv.title')}</h1>
          <p class="page-subtitle">${t('adv.subtitle')}</p>
        </div>
      </div>
      <oas-form id="advanced-form" rules='${rulesJSON()}' layout="vertical">
        <oas-card class="adv-card" title="${t('adv.basic')}">
          <div class="adv-grid">
            <oas-form-item label="${t('adv.company')}" required>
              <oas-input name="company" placeholder="${t('adv.companyPh')}"></oas-input>
            </oas-form-item>
            <oas-form-item label="${t('adv.creditCode')}" required>
              <oas-input name="creditCode" placeholder="${t('adv.creditCodePh')}"></oas-input>
            </oas-form-item>
            <oas-form-item label="${t('adv.founded')}">
              <oas-date-picker placeholder="${t('adv.foundedPh')}"></oas-date-picker>
            </oas-form-item>
            <oas-form-item label="${t('adv.staff')}">
              <oas-slider min="0" max="5000" step="100" value="200" data-testid="adv-staff"></oas-slider>
            </oas-form-item>
          </div>
        </oas-card>
        <oas-card class="adv-card" title="${t('adv.contact')}">
          <div class="adv-grid">
            <oas-form-item label="${t('adv.phone')}">
              <oas-auto-complete name="phone" placeholder="${t('adv.phonePh')}" options='${JSON.stringify(data.phones)}'></oas-auto-complete>
            </oas-form-item>
            <oas-form-item label="${t('adv.address')}">
              <oas-cascader placeholder="${t('adv.addressPh')}" options='${JSON.stringify(data.regions)}'></oas-cascader>
            </oas-form-item>
            <oas-form-item label="${t('adv.pinLabel')}">
              <oas-pin-input length="4" data-testid="adv-pin"></oas-pin-input>
            </oas-form-item>
            <oas-form-item label="${t('adv.email')}">
              <oas-input name="email" type="email" placeholder="${t('adv.emailPh')}"></oas-input>
            </oas-form-item>
          </div>
        </oas-card>
        <oas-card class="adv-card" title="${t('adv.biztitle')}">
          <div class="adv-grid">
            <oas-form-item label="${t('adv.category')}" required>
              <oas-combobox name="category" placeholder="${t('adv.categoryPh')}" options='${JSON.stringify(catOptions())}'></oas-combobox>
            </oas-form-item>
            <oas-form-item label="${t('adv.rating')}">
              <oas-rate value="3" data-testid="adv-rating"></oas-rate>
            </oas-form-item>
            <oas-form-item label="${t('adv.tags')}">
              <oas-dynamic-tags placeholder="${t('adv.tagsPh')}" data-testid="adv-tags"></oas-dynamic-tags>
            </oas-form-item>
            <oas-form-item label="${t('adv.region')}">
              <oas-tree-select placeholder="${t('adv.regionPh')}" options='${JSON.stringify(data.treeRegions)}'></oas-tree-select>
            </oas-form-item>
          </div>
        </oas-card>
        <oas-card class="adv-card" title="${t('adv.coop')}">
          <div class="adv-grid">
            <oas-form-item label="${t('adv.channels')}">
              <oas-transfer data-testid="adv-transfer" data='${JSON.stringify(channelOptions())}'></oas-transfer>
            </oas-form-item>
            <oas-form-item label="${t('adv.notify')}">
              <oas-switch></oas-switch>
            </oas-form-item>
          </div>
        </oas-card>
        <oas-space>
          <oas-button type="primary" data-action="submit">${t('adv.submit')}</oas-button>
          <oas-button data-action="reset">${t('basic.reset')}</oas-button>
        </oas-space>
      </oas-form>
    </div>`

  const form = el.querySelector<HTMLElement>('#advanced-form')!

  function collectManual(): void {
    const pick = (sel: string, id: string) =>
      el.querySelector(sel)?.addEventListener('oas-change', (e) => {
        manual[id] = (e as CustomEvent<{ value?: unknown }>).detail?.value
      })
    pick('[data-testid="adv-staff"]', 'staff')
    pick('[data-testid="adv-pin"]', 'pin')
    pick('[data-testid="adv-rating"]', 'rating')
    pick('[data-testid="adv-tags"]', 'tags')
  }
  collectManual()

  form.addEventListener('oas-submit', (e) => {
    formValues = (e as CustomEvent<{ values: Record<string, string> }>).detail.values
    message.success(t('adv.submitted'))
    void Promise.resolve(manual)
  })
  el.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    resetForm(form)
    void formValues
    message.info(t('basic.resetDone'))
  })
  el.querySelector('[data-action="submit"]')?.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  return onLocaleChange(refreshText)
}
