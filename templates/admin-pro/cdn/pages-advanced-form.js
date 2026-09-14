/**
 * 高级表单页（自 vanilla src/pages/advanced-form.ts 去 TS 移植，DOM/类名/testid 对齐）
 * 四分组 17 控件（输入/日期/滑块/自动补全/级联/ PIN/评分/动态标签/树选择/穿梭框等）
 */
import { onLocaleChange, t } from './i18n.js'
import { advFormData } from './data/adv-form.js'

const catOptions = () => [
  { label: t('adv.cat.electronics'), value: 'electronics' },
  { label: t('adv.cat.packaging'), value: 'packaging' },
  { label: t('adv.cat.chemical'), value: 'chemical' },
  { label: t('adv.cat.hardware'), value: 'hardware' },
]

const channelOptions = () => [
  { key: 'online', label: t('adv.channel.online') },
  { key: 'site', label: t('adv.channel.site') },
  { key: 'jd', label: t('adv.channel.jd') },
  { key: 'offline', label: t('adv.channel.offline') },
  { key: 'dealer', label: t('adv.channel.dealer') },
]

const rulesJSON = () =>
  JSON.stringify({
    company: [{ required: true, message: t('adv.ruleCompany') }],
    creditCode: [
      { required: true, message: t('adv.ruleCode') },
      { pattern: '^[0-9A-Z]{18}$', message: t('adv.ruleCodeFmt') },
    ],
    category: [{ required: true, message: t('adv.ruleCategory') }],
  })

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

export function renderAdvancedForm(el) {
  let formValues = {}

  function resetForm(form) {
    form.shadowRoot?.querySelector('form')?.reset()
  }

  function refreshText() {
    const data = advFormData()
    el.querySelector('h1.page-title').textContent = t('adv.title')
    el.querySelector('p.page-subtitle').textContent = t('adv.subtitle')
    const cards = el.querySelectorAll('.adv-card')
    cards[0]?.setAttribute('title', t('adv.basic'))
    cards[1]?.setAttribute('title', t('adv.contact'))
    cards[2]?.setAttribute('title', t('adv.biztitle'))
    cards[3]?.setAttribute('title', t('adv.coop'))
    const items = el.querySelectorAll('oas-form-item')
    items.forEach((item, i) => {
      const key = ITEM_KEYS[i]
      if (key) item.setAttribute('label', t(key))
    })
    el.querySelector('oas-input[name="company"]')?.setAttribute('placeholder', t('adv.companyPh'))
    el
      .querySelector('oas-input[name="creditCode"]')
      ?.setAttribute('placeholder', t('adv.creditCodePh'))
    el.querySelector('oas-date-picker')?.setAttribute('placeholder', t('adv.foundedPh'))
    el.querySelector('oas-auto-complete')?.setAttribute('placeholder', t('adv.phonePh'))
    el.querySelector('oas-cascader')?.setAttribute('placeholder', t('adv.addressPh'))
    el.querySelector('oas-input[name="email"]')?.setAttribute('placeholder', t('adv.emailPh'))
    el.querySelector('oas-combobox')?.setAttribute('placeholder', t('adv.categoryPh'))
    el.querySelector('oas-combobox')?.setAttribute('options', JSON.stringify(catOptions()))
    el.querySelector('oas-dynamic-tags')?.setAttribute('placeholder', t('adv.tagsPh'))
    el.querySelector('oas-tree-select')?.setAttribute('placeholder', t('adv.regionPh'))
    el.querySelector('oas-transfer')?.setAttribute('data', JSON.stringify(channelOptions()))
    el.querySelector('oas-auto-complete')?.setAttribute('options', JSON.stringify(data.phones))
    el.querySelector('oas-cascader')?.setAttribute('options', JSON.stringify(data.regions))
    el.querySelector('oas-tree-select')?.setAttribute('options', JSON.stringify(data.treeRegions))
    el.querySelector('[data-action="submit"]').textContent = t('adv.submit')
    el.querySelector('[data-action="reset"]').textContent = t('basic.reset')
    el.querySelector('#advanced-form')?.setAttribute('rules', rulesJSON())
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
              <oas-slider name="staff" min="0" max="5000" step="100" value="200" data-testid="adv-staff"></oas-slider>
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
              <oas-pin-input name="pin" length="4" data-testid="adv-pin"></oas-pin-input>
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
              <oas-rate name="rating" value="3" data-testid="adv-rating"></oas-rate>
            </oas-form-item>
            <oas-form-item label="${t('adv.tags')}">
              <oas-dynamic-tags name="tags" placeholder="${t('adv.tagsPh')}" data-testid="adv-tags"></oas-dynamic-tags>
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

  const form = el.querySelector('#advanced-form')

  form.addEventListener('oas-submit', (e) => {
    formValues = e.detail.values
    OASUI.message.success(t('adv.submitted'))
  })
  el.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    resetForm(form)
    void formValues
    OASUI.message.info(t('basic.resetDone'))
  })
  el.querySelector('[data-action="submit"]')?.addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  document.title = `${t('nav.advancedForm')} · ${t('app.title')}`
  return onLocaleChange(refreshText)
}
