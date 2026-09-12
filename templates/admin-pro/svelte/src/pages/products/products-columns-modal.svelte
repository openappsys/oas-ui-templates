<script lang="ts">
  // src/pages/products/products-columns-modal.svelte —— 商品列设置弹窗（显隐列 + 偏好持久化）
  // 1. visible 受控：父组件 state 单一持有；组件侧关闭（遮罩/Esc/✕）监听 onoas-close 回写，
  //    否则组件自闭后与 state 失同步
  // 2. 重置/完成按钮位于 oas-modal panel 内，panel 对原生 click stopPropagation；Svelte 的
  //    onclick 直绑元素本身，不受该陷阱影响，直接模板直绑
  // 3. checkbox 的 oas-change 经 light DOM 冒泡到 oas-modal host，委托监听（detail.checked/value
  //    判定增删列）；writeProductColumns 持久化后经 onChange 回写父组件 state 驱动 column-keys 重算
  import { useT } from '../../lib/use-t.svelte'
  import { PRODUCT_COLUMN_KEYS, PRODUCT_COLUMN_MANDATORY, writeProductColumns } from './product-columns'
  import type { ProductColumnKey } from './product-columns'

  interface Props {
    open: boolean
    columnKeys: ProductColumnKey[]
    /** 勾选/重置后的新列集合（本组件已先行持久化，父组件只负责 setState） */
    onChange: (keys: ProductColumnKey[]) => void
    onClose: () => void
  }

  let { open, columnKeys, onChange, onClose }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  // checkbox 的 oas-change 委托在弹窗 host 上：过滤非列 key 与强制列，增删后持久化 + 上抛
  function onColumnsChange(e: Event): void {
    const detail = (e as CustomEvent<{ checked: boolean; value: string }>).detail
    if (!detail) return
    const key = detail.value as ProductColumnKey
    if (!PRODUCT_COLUMN_KEYS.includes(key) || PRODUCT_COLUMN_MANDATORY.includes(key)) return
    const next = detail.checked
      ? columnKeys.includes(key)
        ? columnKeys
        : [...columnKeys, key]
      : columnKeys.filter((k) => k !== key)
    writeProductColumns(next)
    onChange(next)
  }

  // 重置=恢复默认列并持久化；完成=关闭弹窗（panel 内原生 click，直绑）
  function onReset(): void {
    const next = [...PRODUCT_COLUMN_KEYS]
    writeProductColumns(next)
    onChange(next)
  }
</script>

<oas-modal
  data-testid="product-columns-modal"
  id="product-columns-modal"
  title={tt('products.columns.title')}
  no-footer
  visible={open ? '' : null}
  onoas-change={onColumnsChange}
  onoas-close={() => onClose()}
>
  <div class="product-columns-list" data-testid="product-columns-list">
    {#each PRODUCT_COLUMN_KEYS as key (key)}
      {@const colTitle = key === 'category' ? tt('products.category') : tt(`products.th.${key}`)}
      {@const mandatory = PRODUCT_COLUMN_MANDATORY.includes(key)}
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="product-column-check">
        <oas-checkbox
          data-testid={`product-columns-${key}`}
          value={key}
          checked={mandatory || columnKeys.includes(key) ? '' : null}
          disabled={mandatory ? '' : null}
        >
          {colTitle}
        </oas-checkbox>
      </label>
    {/each}
  </div>
  <div class="form-actions">
    <oas-space justify="end">
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <oas-button data-testid="product-columns-reset" onclick={onReset}>
        {tt('products.columns.reset')}
      </oas-button>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <oas-button data-testid="product-columns-close" type="primary" onclick={() => onClose()}>
        {tt('common.save')}
      </oas-button>
    </oas-space>
  </div>
</oas-modal>
