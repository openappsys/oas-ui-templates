<script lang="ts">
  // src/pages/products/products-table.svelte —— 商品列表视图（oas-table + 空态 + 行内编辑 + 行事件）
  // 1. columns 含 render 函数（返回真实 DOM 节点），JSON 序列化会丢函数，故走 property 通道：
  //    bind:this + $effect 命令式赋 el.columns（render 收整行 row）；列定义随 locale 重建
  // 2. 行事件：oas-check/oas-edit 自定义事件 onoas-* 模板直绑；oas-change 用 composedPath[0]
  //    取实际点击的开关（render 出的 oas-switch）；编辑按钮的原生 click 是 composed 事件，
  //    能冒泡出 oas-table shadow 到容器 onclick（Svelte 直绑元素本身，无根委托歧义）
  import type { TableColumn } from '@oas-ui/ui/data/table'
  import { stockLevel } from '../../data/products'
  import type { ProductRow } from '../../data/products'
  import { useT } from '../../lib/use-t.svelte'
  import type { ProductColumnKey } from './product-columns'

  interface Props {
    /** 父组件持有引用：清空勾选时需 removeAttribute('selected')（vanilla clearSelection 同款） */
    tableEl: HTMLElement | null
    /** 当前页切片（父组件手动分页，对齐 vanilla renderTableBody 的 slice） */
    rows: ProductRow[]
    columnKeys: ProductColumnKey[]
    canMutate: boolean
    /** 筛选结果为空：表格隐藏 + 空态显示 */
    empty: boolean
    /** 卡片视图时整个表格容器隐藏 */
    hidden: boolean
    onToggleStatus: (id: number) => void
    onEditRow: (id: number) => void
    onCheck: (keys: number[]) => void
    onInlineEdit: (id: number, column: 'price' | 'stock', value: number) => void
  }

  let {
    tableEl = $bindable(null),
    rows,
    columnKeys,
    canMutate,
    empty,
    hidden,
    onToggleStatus,
    onEditRow,
    onCheck,
    onInlineEdit,
  }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  type TFunc = (key: string, params?: Record<string, string | number>) => string

  function formatMoney(n: number): string {
    return `¥ ${n.toLocaleString('en-US')}`
  }

  function cellTag(category: string): HTMLElement {
    const tag = document.createElement('oas-tag')
    tag.className = 'cat-tag'
    tag.textContent = category
    return tag
  }

  function cellPrice(price: number): HTMLElement {
    const span = document.createElement('span')
    span.className = 'mono'
    span.textContent = formatMoney(price)
    return span
  }

  function cellStock(stock: number, t: TFunc): HTMLElement {
    const span = document.createElement('span')
    span.className = `product-stock is-${stockLevel(stock)}`
    span.textContent = t('products.stock', { n: stock })
    return span
  }

  function cellStatus(row: ProductRow): HTMLElement {
    const sw = document.createElement('oas-switch')
    sw.setAttribute('data-testid', 'product-switch')
    sw.setAttribute('data-id', String(row.id))
    if (row.status === 'on') sw.setAttribute('checked', '')
    return sw
  }

  function cellAction(row: ProductRow, t: TFunc): HTMLElement {
    const btn = document.createElement('oas-button')
    btn.className = 'product-edit'
    btn.setAttribute('data-testid', 'product-edit')
    btn.setAttribute('data-id', String(row.id))
    btn.setAttribute('size', 'small')
    btn.setAttribute('icon', 'edit')
    btn.setAttribute('aria-label', t('common.edit'))
    return btn
  }

  /** vanilla TABLE_COLUMNS：price/stock 行内可编辑（列级 editable + validate），status 可过滤 */
  function buildColumns(t: TFunc): TableColumn[] {
    return [
      { key: 'name', title: t('products.th.name') },
      { key: 'category', title: t('products.category'), render: (r) => cellTag(String(r.category)) },
      {
        key: 'price',
        title: t('products.th.price'),
        align: 'right',
        editable: true,
        validate: (value) => {
          const n = Number(value)
          if (!Number.isFinite(n) || n <= 0) return t('products.inlineEdit.priceInvalid')
        },
        render: (r) => cellPrice(Number(r.price)),
      },
      {
        key: 'stock',
        title: t('products.th.stock'),
        editable: true,
        validate: (value) => {
          const n = Number(value)
          if (!Number.isInteger(n) || n < 0) return t('products.inlineEdit.stockInvalid')
        },
        render: (r) => cellStock(Number(r.stock), t),
      },
      {
        key: 'status',
        title: t('products.th.status'),
        filterable: true,
        filters: [
          { label: t('products.status.on'), value: 'on' },
          { label: t('products.status.off'), value: 'off' },
        ],
        render: (r) => cellStatus(r as unknown as ProductRow),
      },
      {
        key: 'action',
        title: t('products.th.action'),
        render: (r) => cellAction(r as unknown as ProductRow, t),
      },
    ]
  }

  // 列定义按 locale 重建（t 闭包随 locale 变化才需重算），property 通道命令式赋值
  const columns = $derived.by(() => {
    void $locale
    return buildColumns(t)
  })

  $effect(() => {
    if (tableEl) (tableEl as unknown as { columns: TableColumn[] }).columns = columns
  })

  function onCheckEvent(e: Event): void {
    const { keys } = (e as CustomEvent<{ keys: string[] }>).detail
    onCheck(keys.map(Number).filter((n) => Number.isFinite(n)))
  }

  function onEditEvent(e: Event): void {
    if (!canMutate) return
    const { key, column, value } = (e as CustomEvent<{ key: string; column: string; value: unknown }>)
      .detail
    const id = Number(key)
    if (!Number.isFinite(id) || (column !== 'price' && column !== 'stock')) return
    onInlineEdit(id, column, Number(value))
  }

  // 表格内状态开关（render 出的 oas-switch）：委托容器的 oas-change，composedPath[0] 取实际开关
  function onTableChange(e: Event): void {
    const sw = e.composedPath()[0] as HTMLElement
    if (sw.getAttribute?.('data-testid') !== 'product-switch') return
    const id = Number(sw.getAttribute('data-id'))
    if (id) onToggleStatus(id)
  }

  // 行内编辑按钮：原生 click 是 composed 事件，能冒泡出 oas-table shadow 到容器
  function onWrapClick(e: MouseEvent): void {
    const btn = e
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('.product-edit'))
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    if (id) onEditRow(id)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="table-wrap products-table-wrap" hidden={hidden} onclick={onWrapClick}>
  <oas-table
    bind:this={tableEl}
    data-testid="product-table"
    row-key="id"
    checkable
    stripe
    editable={canMutate ? '' : null}
    class={empty ? 'table-hidden' : ''}
    data={JSON.stringify(rows)}
    column-keys={JSON.stringify(columnKeys)}
    onoas-check={onCheckEvent}
    onoas-edit={onEditEvent}
    onoas-change={onTableChange}
  ></oas-table>
  <div class="product-list-empty" data-testid="product-empty" hidden={!empty}>
    <oas-empty description={tt('products.empty')}></oas-empty>
  </div>
</div>
