// src/pages/basic-form.tsx —— 基础表单（10 种控件组合 + 校验/重置）
// 行为事实来源：vanilla-html/src/pages/basic-form.ts（150 行，逐块对齐）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 用 innerHTML 拼装 + onLocaleChange(refreshText) 逐节点 setAttribute；
//    本模版声明式 JSX，useT() 订阅 locale 后整页重渲染，rules/options/label/placeholder 等
//    随 locale 自动重算（dashboard 同款模式）
// 2. 事件：oas-form 的 oas-submit 自定义事件走 useOasEvent（AGENTS.md 第 1 条）；提交/重置
//    按钮为 light DOM 原生 click，直绑 onClick；提交经 shadowRoot 内原生 form 的
//    requestSubmit()，重置经其 reset()（与 vanilla 同一通道）
// 3. 文案怪癖保留：vanilla 的 date-picker label 用 t('basic.days')、upload label 用
//    t('basic.contact')（且这些组件实际不渲染 label 属性），逐字保留保证 DOM/行为对齐
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

  // vanilla oas-submit 段：仅提示
  useOasEvent(formRef, 'oas-submit', () => {
    appMessage.success(t('basic.submitted'))
  })

  // vanilla reset 段：原生 form reset + 提示
  const onReset = () => {
    ;(formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.reset()
    appMessage.info(t('basic.resetDone'))
  }
  // vanilla submit 按钮：触发内部原生 form 提交（rules 校验后发 oas-submit）
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
