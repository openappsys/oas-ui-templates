<script lang="ts">
  // src/pages/advanced-form.svelte —— 高级表单（17 种控件组合 + 校验）
  // 声明式模板，useT() 订阅 locale 后整页重渲，rules/options/placeholder 等 JSON attribute
  // 随之重算。事件：oas-form 的 oas-submit（已声明）模板直绑；提交/重置按钮为 oas-button
  // 原生 click 直绑；提交经 shadowRoot 内原生 form 的 requestSubmit 触发（跨 shadow 提交通道）。
  // loose 声明控件的未声明属性走 {...{}} 展开通道（app.d.ts 仅宽松基座，为并发批次零冲突）。
  import '../styles/pages/advanced-form.css'
  import { advFormData } from '../data/adv-form'
  import { useT } from '../lib/use-t.svelte'
  import { appMessage } from '../lib/app-message'

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重算 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let formEl: HTMLElement | null = $state(null)

  /** 触发 oas-form 内部原生 form 的提交/重置（vanilla 同款 shadowRoot 通道） */
  function nativeForm(): HTMLFormElement | null {
    return (formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null) ?? null
  }

  function onFormSubmit(): void {
    appMessage.success(t('adv.submitted'))
  }

  function onSubmit(): void {
    nativeForm()?.requestSubmit()
  }

  function onReset(): void {
    nativeForm()?.reset()
    appMessage.info(t('basic.resetDone'))
  }

  const data = advFormData()

  const rules = $derived(
    JSON.stringify({
      company: [{ required: true, message: tt('adv.ruleCompany') }],
      creditCode: [
        { required: true, message: tt('adv.ruleCode') },
        { pattern: '^[0-9A-Z]{18}$', message: tt('adv.ruleCodeFmt') },
      ],
      category: [{ required: true, message: tt('adv.ruleCategory') }],
    }),
  )
  const catOptions = $derived(
    JSON.stringify([
      { label: tt('adv.cat.electronics'), value: 'electronics' },
      { label: tt('adv.cat.packaging'), value: 'packaging' },
      { label: tt('adv.cat.chemical'), value: 'chemical' },
      { label: tt('adv.cat.hardware'), value: 'hardware' },
    ]),
  )
  const channelData = $derived(
    JSON.stringify([
      { key: 'online', label: tt('adv.channel.online') },
      { key: 'site', label: tt('adv.channel.site') },
      { key: 'jd', label: tt('adv.channel.jd') },
      { key: 'offline', label: tt('adv.channel.offline') },
      { key: 'dealer', label: tt('adv.channel.dealer') },
    ]),
  )

  /** placeholder 类静态展开：对象身份随 locale 变化触发 setAttribute */
  const ph = (key: string) => ({ placeholder: tt(key) })
  const foundedAttrs = $derived(ph('adv.foundedPh'))
  const phoneAttrs = $derived({
    name: 'phone',
    options: JSON.stringify(data.phones),
    ...ph('adv.phonePh'),
  })
  const cascaderAttrs = $derived({ options: JSON.stringify(data.regions), ...ph('adv.addressPh') })
  const pinAttrs = $derived({ name: 'pin', length: '4' })
  const comboboxAttrs = $derived({ name: 'category', options: catOptions, ...ph('adv.categoryPh') })
  const tagsAttrs = $derived({ name: 'tags', ...ph('adv.tagsPh') })
  const treeRegionAttrs = $derived({
    options: JSON.stringify(data.treeRegions),
    ...ph('adv.regionPh'),
  })
  const transferAttrs = $derived({ data: channelData })
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('adv.title')}</h1>
      <p class="page-subtitle">{tt('adv.subtitle')}</p>
    </div>
  </div>
  <oas-form
    bind:this={formEl}
    id="advanced-form"
    {rules}
    layout="vertical"
    onoas-submit={onFormSubmit}
  >
    <oas-card class="adv-card" title={tt('adv.basic')}>
      <div class="adv-grid">
        <oas-form-item label={tt('adv.company')} required>
          <oas-input name="company" {...ph('adv.companyPh')}></oas-input>
        </oas-form-item>
        <oas-form-item label={tt('adv.creditCode')} required>
          <oas-input name="creditCode" {...ph('adv.creditCodePh')}></oas-input>
        </oas-form-item>
        <oas-form-item label={tt('adv.founded')}>
          <oas-date-picker {...foundedAttrs}></oas-date-picker>
        </oas-form-item>
        <oas-form-item label={tt('adv.staff')}>
          <oas-slider
            {...{ name: 'staff', min: '0', max: '5000', step: '100', value: '200' }}
            data-testid="adv-staff"
          ></oas-slider>
        </oas-form-item>
      </div>
    </oas-card>
    <oas-card class="adv-card" title={tt('adv.contact')}>
      <div class="adv-grid">
        <oas-form-item label={tt('adv.phone')}>
          <oas-auto-complete {...phoneAttrs}></oas-auto-complete>
        </oas-form-item>
        <oas-form-item label={tt('adv.address')}>
          <oas-cascader {...cascaderAttrs}></oas-cascader>
        </oas-form-item>
        <oas-form-item label={tt('adv.pinLabel')}>
          <oas-pin-input data-testid="adv-pin" {...pinAttrs}></oas-pin-input>
        </oas-form-item>
        <oas-form-item label={tt('adv.email')}>
          <oas-input name="email" type="email" {...ph('adv.emailPh')}></oas-input>
        </oas-form-item>
      </div>
    </oas-card>
    <oas-card class="adv-card" title={tt('adv.biztitle')}>
      <div class="adv-grid">
        <oas-form-item label={tt('adv.category')} required>
          <oas-combobox {...comboboxAttrs}></oas-combobox>
        </oas-form-item>
        <oas-form-item label={tt('adv.rating')}>
          <oas-rate data-testid="adv-rating" {...{ name: 'rating', value: '3' }}></oas-rate>
        </oas-form-item>
        <oas-form-item label={tt('adv.tags')}>
          <oas-dynamic-tags data-testid="adv-tags" {...tagsAttrs}></oas-dynamic-tags>
        </oas-form-item>
        <oas-form-item label={tt('adv.region')}>
          <oas-tree-select {...treeRegionAttrs}></oas-tree-select>
        </oas-form-item>
      </div>
    </oas-card>
    <oas-card class="adv-card" title={tt('adv.coop')}>
      <div class="adv-grid">
        <oas-form-item label={tt('adv.channels')}>
          <oas-transfer data-testid="adv-transfer" {...transferAttrs}></oas-transfer>
        </oas-form-item>
        <oas-form-item label={tt('adv.notify')}>
          <oas-switch></oas-switch>
        </oas-form-item>
      </div>
    </oas-card>
    <oas-space>
      <oas-button type="primary" data-action="submit" onclick={onSubmit}>
        {tt('adv.submit')}
      </oas-button>
      <oas-button data-action="reset" onclick={onReset}>{tt('basic.reset')}</oas-button>
    </oas-space>
  </oas-form>
</div>
