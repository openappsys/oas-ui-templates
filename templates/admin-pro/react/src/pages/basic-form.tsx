// src/pages/basic-form.tsx —— 基础表单（10 种控件组合 + 校验/重置）
// 1. 声明式 JSX，useT() 订阅 locale 后整页重渲染，rules/options/label/placeholder 等
//    随 locale 自动重算（dashboard 同款模式）
// 2. 事件：oas-form 的 oas-submit 自定义事件走 useOasEvent；提交/重置按钮为 light DOM
//    原生 click 直绑 onClick，经 shadowRoot 内原生 form 的 requestSubmit/reset 触发
// 3. date-picker/upload 的 label 文案怪癖（basic.days/basic.contact）逐字保留
//    （且这些组件实际不渲染 label 属性）
import { useRef } from 'react'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

/** vanilla catOptions */
function catOptions(t: (key: string) => string): Array<{ label: string; value: string }> {
  return [
    { label: t('basic.catWeb'), value: 'web' },
    { label: t('basic.catMobile'), value: 'mobile' },
    { label: t('basic.catData'), value: 'data' },
  ]
}

/** vanilla statusOptions */
function statusOptions(t: (key: string) => string): Array<{ label: string; value: string }> {
  return [
    { label: t('basic.stDev'), value: 'dev' },
    { label: t('basic.stLive'), value: 'live' },
  ]
}

/** vanilla rulesJSON */
function rulesJSON(t: (key: string) => string): string {
  return JSON.stringify({
    name: [{ required: true, message: t('basic.ruleName') }],
    category: [{ required: true, message: t('basic.ruleCategory') }],
    contact: [
      { required: true, message: t('basic.ruleEmail') },
      { pattern: '^\\S+@\\S+$', message: t('basic.ruleEmailFmt') },
    ],
  })
}

export default function BasicFormPage() {
  const { t } = useT()
  const formRef = useRef<HTMLElement | null>(null)

  useOasEvent(formRef, 'oas-submit', () => {
    appMessage.success(t('basic.submitted'))
  })

  const onReset = () => {
    ;(formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.reset()
    appMessage.info(t('basic.resetDone'))
  }
  const onSubmit = () => {
    ;(formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('basic.title')}</h1>
          <p className="page-subtitle">{t('basic.subtitle')}</p>
        </div>
      </div>
      <oas-card className="list-card" title={t('basic.card')}>
        <oas-form ref={formRef} id="basic-form" rules={rulesJSON(t)}>
          <div className="form-grid form-grid--2col">
            <oas-input name="name" label={t('basic.name')} placeholder={t('basic.name')} />
            <oas-select
              name="category"
              label={t('basic.category')}
              options={JSON.stringify(catOptions(t))}
              placeholder={t('basic.category')}
            />
            <oas-select
              name="status"
              label={t('basic.status')}
              options={JSON.stringify(statusOptions(t))}
              placeholder={t('basic.status')}
            />
            <oas-input name="days" type="number" label={t('basic.days')} />
            <oas-input name="budget" type="number" label={t('basic.budget')} />
            <oas-input name="contact" label={t('basic.contact')} placeholder={t('basic.contact')} />
            <oas-textarea name="desc" label={t('basic.desc')} />
            <oas-switch name="notify" label={t('basic.notify')} />
            <oas-date-picker name="due" label={t('basic.days')} />
            <oas-upload name="file" label={t('basic.contact')} />
          </div>
          <oas-space>
            <oas-button type="primary" data-action="submit" onClick={onSubmit}>
              {t('basic.submit')}
            </oas-button>
            <oas-button data-action="reset" onClick={onReset}>
              {t('basic.reset')}
            </oas-button>
          </oas-space>
        </oas-form>
      </oas-card>
    </div>
  )
}
