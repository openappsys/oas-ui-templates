<script lang="ts">
  // src/pages/dict-item-modal.svelte —— 字典键值弹窗（新增/编辑双态，表单事件自包含）
  // 1. visible 由父组件 open 单一事实来源驱动；组件侧关闭（遮罩/Esc/✕）经 oas-close 回写
  // 2. open 边沿 $effect 逐字段 setAttribute 回填（编辑态带出当前值，sort 数字转字符串）
  // 3. 取消/保存按钮为 oas-button，Svelte 原生直绑 onclick（不走根委托，panel 内亦可达）；
  //    保存经 shadowRoot 内原生 form 的 requestSubmit 触发（跨 shadow 提交通道）
  import { useT } from '../lib/use-t.svelte'

  interface DictItemFormValues {
    label?: string
    value?: string
    sort?: string
  }

  interface Props {
    open: boolean
    /** 编辑目标（null → 新建态） */
    editing: { label?: string; value?: string; sort?: number } | null
    onClose: () => void
    onSubmit: (values: DictItemFormValues) => void
  }

  let { open, editing, onClose, onSubmit }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重算 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let modalEl: HTMLElement | null = $state(null)
  let formEl: HTMLElement | null = $state(null)
  let labelEl: HTMLElement | null = $state(null)
  let valueEl: HTMLElement | null = $state(null)
  let sortEl: HTMLElement | null = $state(null)

  /** vanilla RULES_ITEM：标签/键值必填 */
  const rules = $derived(
    JSON.stringify({
      label: [{ required: true, message: tt('dict.rule.label') }],
      value: [{ required: true, message: tt('dict.rule.value') }],
    }),
  )

  // open 边沿回填（编辑态带出当前值，sort 数字转字符串）
  $effect(() => {
    if (!open) return
    void editing
    labelEl?.setAttribute('value', editing?.label ?? '')
    valueEl?.setAttribute('value', editing?.value ?? '')
    sortEl?.setAttribute('value', editing ? String(editing.sort) : '')
  })

  /** 保存：触发 oas-form shadow 内原生 form 提交（跨 shadow requestSubmit 通道） */
  function onSave(): void {
    ;(formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

  /** oas-submit：校验通过后的值上行交给父组件编排 */
  function onFormSubmit(e: Event): void {
    const { values } = (e as CustomEvent<{ values: DictItemFormValues }>).detail
    onSubmit(values)
  }
</script>

<oas-modal
  bind:this={modalEl}
  data-testid="dict-item-modal"
  no-footer
  visible={open ? '' : null}
  onoas-close={onClose}
>
  <div class="modal-body">
    <h2 id="dict-item-title">
      {editing == null ? tt('dict.newItem') : tt('dict.editItem', { label: editing.label ?? '' })}
    </h2>
    <oas-form bind:this={formEl} {rules} onoas-submit={onFormSubmit}>
      <div class="dict-form-body">
        <div class="form-field">
          <label class="form-label">
            {tt('dict.form.label')} <span class="req">*</span>
          </label>
          <oas-input
            bind:this={labelEl}
            data-testid="dif-label"
            name="label"
            placeholder={tt('dict.placeholder.label')}
          ></oas-input>
        </div>
        <div class="form-field">
          <label class="form-label">
            {tt('dict.form.value')} <span class="req">*</span>
          </label>
          <oas-input
            bind:this={valueEl}
            data-testid="dif-value"
            name="value"
            placeholder={tt('dict.placeholder.value')}
          ></oas-input>
        </div>
        <div class="form-field">
          <label class="form-label">{tt('dict.form.sort')}</label>
          <oas-input-number
            bind:this={sortEl}
            data-testid="dif-sort"
            name="sort"
            min="0"
            placeholder="1"
          ></oas-input-number>
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="dif-cancel" onclick={onClose}>{tt('common.cancel')}</oas-button>
            <oas-button data-testid="dif-save" type="primary" onclick={onSave}>
              {tt('common.save')}
            </oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  </div>
</oas-modal>
