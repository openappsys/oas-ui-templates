<script lang="ts">
  // src/pages/orders-table.svelte —— 订单列表表格（oas-table 内置分页 + 状态/金额/品名 render 列）
  // 对齐 react 版 orders-table.tsx / vue 版 orders-table.vue：
  // 1. columns 含 render 函数（返回真实 DOM 节点），JSON 序列化会丢函数，故走 property 通道
  //    （bind:this + $effect；oas-table 的 columns setter 双通道均支持）；随 locale 重算
  // 2. data 走 JSON 字符串 attribute 通道（空数组即 '[]'）；is-empty 类驱动空态覆盖层显隐
  // 3. 布尔 attribute 存在性语义：loading/pagination 按 {cond ? '' : null} 绑定；current 复位
  //    经 export 的 resetPage() 走同一 setAttribute 通道（父组件在搜索/切 tab 后调用）
  import type { TableColumn } from '@oas-ui/ui/data/table'
  import type { OrderRow } from '../data/orders'
  import { useT } from '../lib/use-t.svelte'
  import { formatMoney, itemSummary, setTagType, statusLabel } from './orders-shared'

  interface Props {
    /** 父组件已过滤的行（data 由父组件 JSON 通道传入同源数据） */
    rows: OrderRow[]
    /** 关键字/状态过滤结果为空：空态覆盖层显示 */
    empty: boolean
    loading: boolean
    pageSize: number
    onRowOpen: (row: OrderRow) => void
    onClearFilter: () => void
  }

  let { rows, empty, loading, pageSize, onRowOpen, onClearFilter }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let tableEl: HTMLElement | null = $state(null)

  /** vanilla TABLE_COLUMNS：序号/金额汇总/富内容列逐字对齐；含 render 函数走 property 通道 */
  const columns = $derived.by<TableColumn[]>(() => {
    void $locale
    return [
      { key: 'no', title: '#', serialNumber: true, width: '48px' },
      { key: 'id', title: tt('orders.th.no') },
      { key: 'customer', title: tt('orders.th.customer') },
      {
        key: 'items',
        title: tt('orders.th.items'),
        ellipsis: true,
        render: (r) => itemSummary((r as unknown as OrderRow).items, tt),
      },
      {
        key: 'amount',
        title: tt('orders.th.amount'),
        align: 'right',
        summary: 'sum',
        render: (r) => {
          const span = document.createElement('span')
          span.className = 'mono'
          span.textContent = formatMoney((r as unknown as OrderRow).amount)
          return span
        },
      },
      {
        key: 'status',
        title: tt('orders.th.status'),
        render: (r) => {
          const row = r as unknown as OrderRow
          const tag = document.createElement('oas-tag')
          tag.textContent = statusLabel(row.status, tt)
          setTagType(tag, row.status)
          return tag
        },
      },
      { key: 'created', title: tt('orders.th.created') },
    ]
  })

  // columns 走 property 通道（attribute 会把函数 JSON 掉）；每次重算整组赋值
  $effect(() => {
    if (tableEl) (tableEl as HTMLElement & { columns: TableColumn[] }).columns = columns
  })

  // data 走 JSON 字符串通道（空数组即 '[]'，配合空态覆盖层）
  const rowsJson = $derived(JSON.stringify(rows))

  function onRowClick(e: Event): void {
    const row = (e as CustomEvent<{ row: OrderRow }>).detail?.row
    if (row?.id) onRowOpen(row)
  }

  /** 搜索/切 tab 后人工复位首屏（vanilla setAttribute('current','1') 同通道） */
  export function resetPage(): void {
    tableEl?.setAttribute('current', '1')
  }
</script>

<div class="table-wrap" class:is-empty={empty} id="orders-table-wrap">
  <oas-table
    bind:this={tableEl}
    data-testid="orders-list"
    row-key="id"
    empty-text={tt('orders.empty')}
    pagination=""
    page-size={pageSize}
    data={rowsJson}
    loading={loading ? '' : null}
    onoas-row-click={onRowClick}
  ></oas-table>
  <div class="empty-overlay" id="orders-empty" hidden={!empty}>
    <oas-empty description={tt('orders.empty')}></oas-empty>
    <oas-button id="orders-clear" type="primary" onclick={onClearFilter}
      >{tt('common.clearFilter')}</oas-button
    >
  </div>
</div>
