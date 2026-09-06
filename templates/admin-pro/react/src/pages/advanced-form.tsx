// src/pages/advanced-form.tsx —— 高级表单（17 种控件组合 + 校验）
//    本模版声明式 JSX，useT() 订阅 locale 后整页重渲染，rules/options/placeholder 等
//    JSON attribute 随之重算（dashboard 同款模式）
// 2. 事件：oas-form 的 oas-submit 自定义事件走 useOasEvent//    提交/重置按钮为 light DOM 原生 click，直绑 onClick；提交经 shadowRoot 内原生 form
//    仅保留 message.success 提示（可观察行为一致）
import { useRef } from 'react'
import '../styles/pages/advanced-form.css'
import { advFormData } from '../data/adv-form'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

/** 触发 oas-form 内部原生 form 的提交/重置（vanilla 同款 shadowRoot 通道） */
function nativeForm(form: HTMLElement | null): HTMLFormElement | null {
  return (form?.shadowRoot?.querySelector('form') as HTMLFormElement | null) ?? null
}

export default function AdvancedFormPage() {
  const { t } = useT()
  const formRef = useRef<HTMLElement | null>(null)

  useOasEvent<{ values: Record<string, string> }>(formRef, 'oas-submit', () => {
    appMessage.success(t('adv.submitted'))
  })

  const data = advFormData()
  const rules = JSON.stringify({
    company: [{ required: true, message: t('adv.ruleCompany') }],
    creditCode: [
      { required: true, message: t('adv.ruleCode') },
      { pattern: '^[0-9A-Z]{18}$', message: t('adv.ruleCodeFmt') },
    ],
    category: [{ required: true, message: t('adv.ruleCategory') }],
  })
  const catOptions = JSON.stringify([
    { label: t('adv.cat.electronics'), value: 'electronics' },
    { label: t('adv.cat.packaging'), value: 'packaging' },
    { label: t('adv.cat.chemical'), value: 'chemical' },
    { label: t('adv.cat.hardware'), value: 'hardware' },
  ])
  const channelData = JSON.stringify([
    { key: 'online', label: t('adv.channel.online') },
    { key: 'site', label: t('adv.channel.site') },
    { key: 'jd', label: t('adv.channel.jd') },
    { key: 'offline', label: t('adv.channel.offline') },
    { key: 'dealer', label: t('adv.channel.dealer') },
  ])

  const onReset = () => {
    nativeForm(formRef.current)?.reset()
    appMessage.info(t('basic.resetDone'))
  }
  const onSubmit = () => nativeForm(formRef.current)?.requestSubmit()

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('adv.title')}</h1>
          <p className="page-subtitle">{t('adv.subtitle')}</p>
        </div>
      </div>
      <oas-form ref={formRef} id="advanced-form" rules={rules} layout="vertical">
        <oas-card className="adv-card" title={t('adv.basic')}>
          <div className="adv-grid">
            <oas-form-item label={t('adv.company')} required>
              <oas-input name="company" placeholder={t('adv.companyPh')} />
            </oas-form-item>
            <oas-form-item label={t('adv.creditCode')} required>
              <oas-input name="creditCode" placeholder={t('adv.creditCodePh')} />
            </oas-form-item>
            <oas-form-item label={t('adv.founded')}>
              <oas-date-picker placeholder={t('adv.foundedPh')} />
            </oas-form-item>
            <oas-form-item label={t('adv.staff')}>
              <oas-slider
                name="staff"
                min="0"
                max="5000"
                step="100"
                value="200"
                data-testid="adv-staff"
              />
            </oas-form-item>
          </div>
        </oas-card>
        <oas-card className="adv-card" title={t('adv.contact')}>
          <div className="adv-grid">
            <oas-form-item label={t('adv.phone')}>
              <oas-auto-complete
                name="phone"
                placeholder={t('adv.phonePh')}
                options={JSON.stringify(data.phones)}
              />
            </oas-form-item>
            <oas-form-item label={t('adv.address')}>
              <oas-cascader
                placeholder={t('adv.addressPh')}
                options={JSON.stringify(data.regions)}
              />
            </oas-form-item>
            <oas-form-item label={t('adv.pinLabel')}>
              <oas-pin-input name="pin" length="4" data-testid="adv-pin" />
            </oas-form-item>
            <oas-form-item label={t('adv.email')}>
              <oas-input name="email" type="email" placeholder={t('adv.emailPh')} />
            </oas-form-item>
          </div>
        </oas-card>
        <oas-card className="adv-card" title={t('adv.biztitle')}>
          <div className="adv-grid">
            <oas-form-item label={t('adv.category')} required>
              <oas-combobox
                name="category"
                placeholder={t('adv.categoryPh')}
                options={catOptions}
              />
            </oas-form-item>
            <oas-form-item label={t('adv.rating')}>
              <oas-rate name="rating" value="3" data-testid="adv-rating" />
            </oas-form-item>
            <oas-form-item label={t('adv.tags')}>
              <oas-dynamic-tags name="tags" placeholder={t('adv.tagsPh')} data-testid="adv-tags" />
            </oas-form-item>
            <oas-form-item label={t('adv.region')}>
              <oas-tree-select
                placeholder={t('adv.regionPh')}
                options={JSON.stringify(data.treeRegions)}
              />
            </oas-form-item>
          </div>
        </oas-card>
        <oas-card className="adv-card" title={t('adv.coop')}>
          <div className="adv-grid">
            <oas-form-item label={t('adv.channels')}>
              <oas-transfer data-testid="adv-transfer" data={channelData} />
            </oas-form-item>
            <oas-form-item label={t('adv.notify')}>
              <oas-switch />
            </oas-form-item>
          </div>
        </oas-card>
        <oas-space>
          <oas-button type="primary" data-action="submit" onClick={onSubmit}>
            {t('adv.submit')}
          </oas-button>
          <oas-button data-action="reset" onClick={onReset}>
            {t('basic.reset')}
          </oas-button>
        </oas-space>
      </oas-form>
    </div>
  )
}
