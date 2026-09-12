<script lang="ts">
  // src/pages/products/products-batch-bar.svelte —— 商品批量操作栏（表格多选后出现：批量上下架 + 批量删除）
  // 1. 执行逻辑（toggle/removeProduct 循环、clearSelection、appMessage、refresh）留在父组件——
  //    它们依赖 rows/selected；本组件只负责呈现与事件接线
  // 2. 事件绑定：上下架/删除按钮在 light DOM，原生 click 模板直绑 onclick；oas-popconfirm 的
  //    oas-ok 是自定义事件，onoas-ok 模板直绑
  import { useT } from '../../lib/use-t.svelte'

  interface Props {
    /** 卡片视图或无选中项时隐藏 */
    hidden: boolean
    selectedCount: number
    canMutate: boolean
    onBatchStatus: (target: 'on' | 'off') => void
    /** popconfirm 确认删除后回调（父组件执行删除循环 + 提示 + 刷新） */
    onBatchDelete: () => void
  }

  let { hidden, selectedCount, canMutate, onBatchStatus, onBatchDelete }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  const enabled = $derived(canMutate && selectedCount > 0)
</script>

<div class="product-batch-bar" data-testid="product-batch-bar" hidden={hidden}>
  <span class="product-batch-count" data-testid="product-batch-count">
    {selectedCount > 0 ? tt('products.batch.selected', { count: selectedCount }) : ''}
  </span>
  <oas-space class="product-batch-actions" justify="end">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <oas-button
      data-testid="product-batch-unlist"
      size="small"
      disabled={!enabled ? '' : null}
      onclick={() => onBatchStatus('off')}
    >
      {tt('products.batch.unlist')}
    </oas-button>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <oas-button
      data-testid="product-batch-list"
      size="small"
      disabled={!enabled ? '' : null}
      onclick={() => onBatchStatus('on')}
    >
      {tt('products.batch.list')}
    </oas-button>
    <oas-popconfirm
      data-testid="product-batch-del-pop"
      id="product-batch-del-pop"
      title={tt('products.batch.confirmDelete', { count: selectedCount })}
      onoas-ok={() => onBatchDelete()}
    >
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <oas-button
        data-testid="product-batch-delete"
        size="small"
        type="danger"
        disabled={!enabled ? '' : null}
      >
        {tt('products.batch.delete')}
      </oas-button>
    </oas-popconfirm>
  </oas-space>
</div>
