import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t } from './i18n.js'
import { advFormData } from './data/adv-form.js'

function boot() {
  document.title = `${t('adv.title')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './advanced-form.html' })
  // 面包屑：示例 → 高级表单
  window.OASShell.setBreadcrumb([
    { label: 'nav.group.demo', href: './advanced-form.html' },
    { label: 'adv.title' },
  ])
  renderAdvancedForm()
}

// 登录守卫 + 启动渲染（置于模块末尾，避免 TDZ）

function catOptions() {
  return [
    { label: t('adv.cat.electronics'), value: 'electronics' },
    { label: t('adv.cat.packaging'), value: 'packaging' },
    { label: t('adv.cat.chemical'), value: 'chemical' },
    { label: t('adv.cat.hardware'), value: 'hardware' },
  ]
}

function channelOptions() {
  return [
    { key: 'online', label: t('adv.channel.online') },
    { key: 'site', label: t('adv.channel.site') },
    { key: 'jd', label: t('adv.channel.jd') },
    { key: 'offline', label: t('adv.channel.offline') },
    { key: 'dealer', label: t('adv.channel.dealer') },
  ]
}

function rulesJSON() {
  return JSON.stringify({
    company: [{ required: true, message: t('adv.ruleCompany') }],
    creditCode: [
      { required: true, message: t('adv.ruleCode') },
      { pattern: '^[0-9A-Z]{18}$', message: t('adv.ruleCodeFmt') },
    ],
    category: [{ required: true, message: t('adv.ruleCategory') }],
  })
}

function renderAdvancedForm() {
  const form = document.querySelector('#advanced-form')
  const data = advFormData()

  // 复合控件 options / data 灌注（文案随 locale）
  form.querySelector('oas-auto-complete').setAttribute('options', JSON.stringify(data.phones))
  form.querySelector('oas-cascader').setAttribute('options', JSON.stringify(data.regions))
  form.querySelector('oas-tree-select').setAttribute('options', JSON.stringify(data.treeRegions))
  form.querySelector('oas-combobox').setAttribute('options', JSON.stringify(catOptions()))
  form.querySelector('oas-transfer').setAttribute('data', JSON.stringify(channelOptions()))
  form.setAttribute('rules', rulesJSON())

  form.addEventListener('oas-submit', () => {
    OASUI.message.success(t('adv.submitted'))
  })

  // 重置：调 oas-form 内部原生 form 的 reset（对齐 vanilla 同款调用）
  document.querySelector('[data-action="reset"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.reset()
    OASUI.message.info(t('basic.resetDone'))
  })

  document.querySelector('[data-action="submit"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })
}

if (guard()) boot()
