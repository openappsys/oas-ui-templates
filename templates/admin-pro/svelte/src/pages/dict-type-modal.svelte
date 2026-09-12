<script lang="ts">
  // src/pages/dict-type-modal.svelte —— 字典类型弹窗（新增/编辑双态，表单事件自包含）
  // 1. visible 由父组件 open 单一事实来源驱动；组件侧关闭（遮罩/Esc/✕）经 oas-close 回写
  // 2. open 边沿 $effect 逐字段 setAttribute 回填（编辑态带出当前值）
  // 3. 取消/保存按钮为 oas-button，Svelte 原生直绑 onclick（不走根委托，panel 内亦可达）；
  //    保存经 shadowRoot 内原生 form 的 requestSubmit 触发（跨 shadow 提交通道）
  import { useT } from '../lib/use-t.svelte'

  interface DictTypeFormValues {
    name?: string
    code?: string
  }

  interface Props {
    open: boolean
    /** 编辑目标（null → 新建态） */
    editing: { name?: string; code?: string } | null
    onClose: () => void
    onSubmit: (values: DictTypeFormValues) => void
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
  let nameEl: HTMLElement | null = $state(null)
  let codeEl: HTMLElement | null = $state(null)

  /** vanilla RULES_TYPE：类型名/编码必填 */
  const rules = $derived(
    JSON.stringify({
      name: [{ required: true, message: tt('dict.rule.typeName') }],
      code: [{ required: true, message: tt('dict.rule.typeCode') }],
    }),
  )

  // open 边沿回填（编辑态带出当前值）
  $effect(() => {
    if (!open) return
    void editing
    nameEl?.setAttribute('value', editing?.name ?? '')
    codeEl?.setAttribute('value', editing?.code ?? '')
  })

  /** 保存：触发 oas-form shadow 内原生 form 提交（跨 shadow requestSubmit 通道） */
  function onSave(): void {
    ;(formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

  /** oas-submit：校验通过后的值上行交给父组件编排 */
  function onFormSubmit(e: Event): void {
    const { values } = (e as CustomEvent<{ values: DictTypeFormValues }>).detail
    onSubmit(values)
  }
</script>

<oas-modal
  bind:this={modalEl}
  data-testid="dict-type-modal"
  no-footer
  visible={open ? '' : null}
  onoas-close={onClose}
>
  <div class="modal-body">
    <h2 id="dict-type-title">
      {editing == null ? tt('dict.newType') : tt('dict.editType', { name: editing.name ?? '' })}
    </h2>
    <oas-form bind:this={formEl} {rules} onoas-submit={onFormSubmit}>
      <div class="dict-form-body">
        <div class="form-field">
          <label class="form-label">
            {tt('dict.form.typeName')} <span class="req">*</span>
          </label>
          <oas-input
            bind:this={nameEl}
            data-testid="dtf-name"
            name="name"
            placeholder={tt('dict.placeholder.typeName')}
          ></oas-input>
        </div>
        <div class="form-field">
          <label class="form-label">
            {tt('dict.form.typeCode')} <span class="req">*</span>
          </label>
          <oas-input
            bind:this={codeEl}
            data-testid="dtf-code"
            name="code"
            placeholder={tt('dict.placeholder.typeCode')}
          ></oas-input>
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="dtf-cancel" onclick={onClose}>{tt('common.cancel')}</oas-button>
            <oas-button data-testid="dtf-save" type="primary" onclick={onSave}>
              {tt('common.save')}
            </oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  </div>
</oas-modal>
