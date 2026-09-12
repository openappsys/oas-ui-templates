<script lang="ts">
  // src/pages/orders-drawer.svelte —— 订单快捷详情抽屉（orders 页行点击弹出）
  // 对齐 react 版 orders-drawer.tsx：
  // 1. visible 受控：oas-close（遮罩/Esc/✕）→ 回写父级 open 状态（属性单一事实来源）
  // 2. 「查看完整详情」链接：sessionStorage('order-detail-id') 与 react 版同键同时机写入 +
  //    preventDefault 走自研 navigate('/order-detail')（hash/history 双模式均正确）
  // 3. 流程按钮：本组件只管 loading 态与取 target，持久化/提示/刷新在父组件（vanilla 同款编排）；
  //    Svelte 的 onclick 直绑元素本身（不走根委托），oas-drawer panel 的 stopPropagation 无影响
  import type { OrderRow, OrderStatus } from '../data/orders'
  import { navigate } from '../router'
  import { useT } from '../lib/use-t.svelte'
  import { formatMoney, statusLabel, tagTypeFor } from './orders-shared'

  interface Props {
    open: boolean
    /** 当前选中订单（父组件由列表数据派生，流程成功后随刷新自动更新，可能为 null） */
    row: OrderRow | null
    onClose: () => void
    /** 流程按钮：父组件执行 updateOrderStatus + 提示 + 刷新（vanilla 同款编排） */
    onApplyFlow: (id: string, target: OrderStatus) => Promise<void>
  }

  let { open, row, onClose, onApplyFlow }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  /** vanilla FLOW_TO：状态流转（pending→paid→shipping→done），终态无可用操作 */
  const FLOW_TO: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: 'paid',
    paid: 'shipping',
    shipping: 'done',
  }

  const flow = $derived(row && FLOW_TO[row.status] ? { to: FLOW_TO[row.status]! } : null)
  // loading 用存在性语义：oas-button 纯 attribute 驱动（原型无 loading 存取器），
  // 布尔 false 会落成 loading="false" 仍被判为 loading——须 {flowing ? '' : null}
  let flowing = $state(false)

  function onLinkClick(e: Event): void {
    if (row?.id) sessionStorage.setItem('order-detail-id', row.id)
    e.preventDefault()
    navigate('/order-detail')
  }

  async function onActionClick(): Promise<void> {
    if (!row || !flow || flowing) return
    flowing = true
    try {
      await onApplyFlow(row.id, flow.to)
    } finally {
      flowing = false
    }
  }

  const note = $derived(
    !row ? '' : row.status === 'done' ? tt('orders.noteDone') : tt('orders.noteCancelled'),
  )

  let drawerEl: HTMLElement | null = $state(null)
  // title 命中 HTMLElement.prototype.title，oas-* 元素上的 title 必须走 setAttribute 通道
  $effect(() => {
    drawerEl?.setAttribute('title', tt('orders.detailTitle'))
  })
</script>

<oas-drawer
  bind:this={drawerEl}
  data-testid="order-drawer"
  placement="right"
  size="medium"
  no-footer
  visible={open ? '' : null}
  onoas-close={onClose}
>
  <div class="order-detail">
    <div class="order-detail-head">
      <div>
        <div class="order-detail-no mono" id="order-detail-no">{row?.id ?? ''}</div>
        <div class="order-detail-sub">{tt('orders.detailTitle')}</div>
      </div>
      {#if row}
        <oas-tag
          data-testid="order-detail-tag"
          id="order-detail-tag"
          type={tagTypeFor(row.status) === 'purple' ? undefined : tagTypeFor(row.status)}
          color={tagTypeFor(row.status) === 'purple' ? 'purple' : undefined}
        >
          {statusLabel(row.status, tt)}
        </oas-tag>
      {/if}
    </div>
    <oas-descriptions id="order-detail-desc" column="1">
      <oas-descriptions-item label={tt('orders.th.customer')}>{row?.customer ?? ''}</oas-descriptions-item>
      <oas-descriptions-item label={tt('orders.dl.creator')}>{row?.creator ?? ''}</oas-descriptions-item>
      <oas-descriptions-item label={tt('orders.th.amount')}>
        <span class="mono">{row ? formatMoney(row.amount) : ''}</span>
      </oas-descriptions-item>
      <oas-descriptions-item label={tt('orders.th.created')}>
        <span class="mono">{row?.created ?? ''}</span>
      </oas-descriptions-item>
      <oas-descriptions-item label={tt('orders.dl.items')}>
        {#each row?.items ?? [] as it, i (`${it}-${i}`)}
          <oas-tag>{it}</oas-tag>
        {/each}
      </oas-descriptions-item>
    </oas-descriptions>
    <div class="order-detail-foot">
      <div class="order-detail-foot-row">
        {#if flow}
          <oas-button
            data-testid="order-detail-action"
            id="order-detail-action"
            type="primary"
            loading={flowing ? '' : null}
            data-target={flow.to}
            onclick={onActionClick}
          >
            {tt(`orders.flow.${row?.status ?? ''}`)}
          </oas-button>
        {/if}
        <a class="link-btn" data-testid="order-detail-link" href="#/order-detail" onclick={onLinkClick}>
          {tt('orders.fullDetail')}
        </a>
      </div>
      {#if !flow}
        <div class="order-detail-note" id="order-detail-note">{note}</div>
      {/if}
    </div>
  </div>
</oas-drawer>
