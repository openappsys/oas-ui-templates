<script lang="ts">
  // src/pages/basic-form.svelte —— 基础表单（10 种控件组合 + 校验/重置）
  // 1. 声明式模板，useT() 订阅 locale 后整页重渲，rules/options/label/placeholder 随 locale 自动重算
  // 2. 事件：oas-form 的 oas-submit（app.d.ts 已声明）模板直绑；提交/重置按钮为 oas-button
  //    原生 click 直绑（Svelte 对 custom element 不走根委托），经 shadowRoot 内原生 form 的
  //    requestSubmit/reset 触发
  // 3. date-picker/upload 的 label 文案怪癖（basic.days/basic.contact）逐字保留
  //    （且这些组件实际不渲染 label 属性）；重置对 oas 控件值实际无效为 vanilla 同款 no-op，保持不修
  import { useT } from '../lib/use-t.svelte'
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

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重算 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let formEl: HTMLElement | null = $state(null)

  /** oas-form shadowRoot 内的原生 form（提交/重置通道，vanilla 同款） */
  function nativeForm(): HTMLFormElement | null {
    return (formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null) ?? null
  }

  function onSubmit(): void {
    nativeForm()?.requestSubmit()
  }

  function onReset(): void {
    nativeForm()?.reset()
    appMessage.info(t('basic.resetDone'))
  }

  function onFormSubmit(): void {
    appMessage.success(t('basic.submitted'))
  }

  // loose 声明控件的未声明属性走展开通道（svelte-check 宽松基座无逐项声明）
  const textareaAttrs = $derived({ name: 'desc', label: tt('basic.desc') })
  const datePickerAttrs = $derived({ name: 'due', label: tt('basic.days') })
  const uploadAttrs = $derived({ name: 'file', label: tt('basic.contact') })
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('basic.title')}</h1>
      <p class="page-subtitle">{tt('basic.subtitle')}</p>
    </div>
  </div>
  <oas-card class="list-card" title={tt('basic.card')}>
    <oas-form bind:this={formEl} id="basic-form" rules={rulesJSON(tt)} onoas-submit={onFormSubmit}>
      <div class="form-grid form-grid--2col">
        <oas-input name="name" label={tt('basic.name')} placeholder={tt('basic.name')}></oas-input>
        <oas-select
          name="category"
          label={tt('basic.category')}
          options={JSON.stringify(catOptions(tt))}
          placeholder={tt('basic.category')}
        ></oas-select>
        <oas-select
          name="status"
          label={tt('basic.status')}
          options={JSON.stringify(statusOptions(tt))}
          placeholder={tt('basic.status')}
        ></oas-select>
        <oas-input name="days" type="number" label={tt('basic.days')}></oas-input>
        <oas-input name="budget" type="number" label={tt('basic.budget')}></oas-input>
        <oas-input name="contact" label={tt('basic.contact')} placeholder={tt('basic.contact')}></oas-input>
        <oas-textarea {...textareaAttrs}></oas-textarea>
        <oas-switch name="notify" label={tt('basic.notify')}></oas-switch>
        <oas-date-picker {...datePickerAttrs}></oas-date-picker>
        <oas-upload {...uploadAttrs}></oas-upload>
      </div>
      <oas-space>
        <oas-button type="primary" data-action="submit" onclick={onSubmit}>
          {tt('basic.submit')}
        </oas-button>
        <oas-button data-action="reset" onclick={onReset}>{tt('basic.reset')}</oas-button>
      </oas-space>
    </oas-form>
  </oas-card>
</div>
