<script lang="ts">
  // src/pages/settings/data-tab.svelte —— 数据与列表 Tab：表单呈现方式/每页条数
  import { appMessage } from '../../lib/app-message'
  import { useT } from '../../lib/use-t.svelte'
  import {
    FORM_MODE_KEY,
    PAGE_SIZE_KEY,
    readFormMode,
    readPageSize,
    type FormMode,
  } from '../../settings-init'

  const FORM_MODE_OPTIONS: Array<{ value: FormMode; labelKey: string; descKey: string }> = [
    {
      value: 'dialog',
      labelKey: 'settings.formMode.dialog',
      descKey: 'settings.formMode.dialogDesc',
    },
    {
      value: 'drawer',
      labelKey: 'settings.formMode.drawer',
      descKey: 'settings.formMode.drawerDesc',
    },
    { value: 'page', labelKey: 'settings.formMode.page', descKey: 'settings.formMode.pageDesc' },
  ]

  const PAGE_SIZES = [5, 10, 20, 50]

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let formMode = $state<FormMode>(readFormMode())
  let pageSize = $state(readPageSize())
  let formModeGroupEl = $state<HTMLDivElement | null>(null)

  // div 组容器委托监听 oas-change：kebab 自定义事件的模板直绑仅声明在 oas-* 组件标签上
  $effect(() => {
    const el = formModeGroupEl
    if (!el) return
    el.addEventListener('oas-change', onFormModeChange)
    return () => el.removeEventListener('oas-change', onFormModeChange)
  })

  const pageSizeOptions = $derived.by(() => {
    void $locale
    return JSON.stringify(
      PAGE_SIZES.map((n) => ({
        label: t('settings.pageSizeItem', { count: n }),
        value: String(n),
      })),
    )
  })

  // oas-radio 组的 oas-change 在组容器上委托：composedPath[0] 取实际变动的 radio
  function onFormModeChange(e: Event): void {
    const radio = e.composedPath()[0] as HTMLElement
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value') as FormMode | null
    if (!v) return
    localStorage.setItem(FORM_MODE_KEY, v)
    formMode = v
    appMessage.success(t('common.saved'))
  }

  function onPageSizeChange(e: Event): void {
    const { value } = (e as CustomEvent<{ value: string }>).detail
    if (!value) return
    localStorage.setItem(PAGE_SIZE_KEY, value)
    pageSize = value
    appMessage.success(t('common.saved'))
  }
</script>

<div class="setting-group">
  <div class="setting-group-title">{tt('settings.general.formModeTitle')}</div>
  <div class="form-hint">{tt('settings.general.formModeHint')}</div>
  <!-- checked 用存在性语义（true→''、false→null 移除属性）：组件按属性存在判定选中 -->
  <div
    id="form-mode-group"
    class="radio-group"
    data-testid="form-mode-group"
    bind:this={formModeGroupEl}
  >
    {#each FORM_MODE_OPTIONS as o (o.value)}
      <oas-radio name="formMode" value={o.value} checked={formMode === o.value ? '' : null}>
        <span class="radio-item">
          <span class="radio-label">{tt(o.labelKey)}</span>
          <span class="radio-desc">{tt(o.descKey)}</span>
        </span>
      </oas-radio>
    {/each}
  </div>
</div>
<div class="setting-group">
  <div class="setting-row">
    <div>
      <div class="setting-label">{tt('settings.general.pageSizeLabel')}</div>
      <div class="setting-hint">{tt('settings.general.pageSizeHint')}</div>
    </div>
    <oas-select
      data-testid="page-size"
      value={pageSize}
      options={pageSizeOptions}
      onoas-change={onPageSizeChange}
    ></oas-select>
  </div>
</div>
