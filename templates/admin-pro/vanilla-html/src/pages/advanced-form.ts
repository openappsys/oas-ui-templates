import { message } from '@oas-ui/ui/feedback/message'
import { onLocaleChange, t } from '../i18n'
import '../styles/pages/advanced-form.css'

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function render(el: HTMLElement): () => void {
  let formValues: Record<string, string> = {}
  const manual: Record<string, unknown> = {}

  function resetForm(form: HTMLElement): void {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.reset()
    for (const k of Object.keys(manual)) manual[k] = undefined
  }

  function draw(): void {
    const regions = () => [
      { label: t('adv.regionEast'), value: 'east' },
      { label: t('adv.regionSouth'), value: 'south' },
      { label: t('adv.regionWest'), value: 'west' },
      { label: t('adv.regionNorth'), value: 'north' },
    ]
    const rules = JSON.stringify({
      company: [{ required: true, message: t('adv.ruleCompany') }],
      creditCode: [
        { required: true, message: t('adv.ruleCode') },
        { pattern: '^[0-9A-Z]{18}$', message: t('adv.ruleCodeFmt') },
      ],
      category: [{ required: true, message: t('adv.ruleCategory') }],
    })
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div>
            <h1 class="page-title">${t('adv.title')}</h1>
            <p class="page-subtitle">${t('adv.subtitle')}</p>
          </div>
        </div>
        <oas-form id="advanced-form" rules='${rules}' layout="vertical">
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
                <oas-auto-complete name="phone" placeholder="${t('adv.phonePh')}" options='${JSON.stringify(PHONES)}'></oas-auto-complete>
              </oas-form-item>
              <oas-form-item label="${t('adv.address')}">
                <oas-cascader placeholder="${t('adv.addressPh')}" options='${JSON.stringify(REGIONS)}'></oas-cascader>
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
                <oas-combobox name="category" placeholder="${t('adv.categoryPh')}" options='${JSON.stringify(CATEGORIES)}'></oas-combobox>
              </oas-form-item>
              <oas-form-item label="${t('adv.rating')}">
                <oas-rate value="3" data-testid="adv-rating"></oas-rate>
              </oas-form-item>
              <oas-form-item label="${t('adv.tags')}">
                <oas-dynamic-tags placeholder="${t('adv.tagsPh')}" data-testid="adv-tags"></oas-dynamic-tags>
              </oas-form-item>
              <oas-form-item label="${t('adv.region')}">
                <oas-tree-select placeholder="${t('adv.regionPh')}" options='${JSON.stringify(TREE_REGIONS)}'></oas-tree-select>
              </oas-form-item>
            </div>
          </oas-card>
          <oas-card class="adv-card" title="${t('adv.coop')}">
            <div class="adv-grid">
              <oas-form-item label="${t('adv.channels')}">
                <oas-transfer data-testid="adv-transfer" data='${JSON.stringify(CHANNELS)}'></oas-transfer>
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
  }

  draw()
  return onLocaleChange(draw)
}

const PHONES = [
  { label: '010-88886666', value: '010-88886666' },
  { label: '021-66668888', value: '021-66668888' },
  { label: '0755-33335555', value: '0755-33335555' },
]

const REGIONS = [
  {
    label: '浙江',
    value: 'zj',
    children: [
      { label: '杭州', value: 'hz' },
      { label: '宁波', value: 'nb' },
    ],
  },
  {
    label: '江苏',
    value: 'js',
    children: [
      { label: '南京', value: 'nj' },
      { label: '苏州', value: 'sz' },
    ],
  },
]

const CATEGORIES = [
  { label: '电子元器件', value: 'electronics' },
  { label: '包装材料', value: 'packaging' },
  { label: '化工原料', value: 'chemical' },
  { label: '五金工具', value: 'hardware' },
]

const TREE_REGIONS = [
  {
    label: '华东',
    value: 'east',
    children: [
      { label: '上海', value: 'sh' },
      { label: '浙江', value: 'zj' },
    ],
  },
  {
    label: '华南',
    value: 'south',
    children: [{ label: '广东', value: 'gd' }],
  },
]

const CHANNELS = [
  { key: 'online', label: '线上渠道' },
  { key: 'site', label: '官方网站' },
  { key: 'jd', label: '京东' },
  { key: 'offline', label: '线下渠道' },
  { key: 'dealer', label: '经销商' },
]
