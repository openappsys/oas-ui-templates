<script lang="ts">
  // src/pages/order-detail.svelte —— 订单详情页（步骤条 + 描述列表 + 时间线 + 状态流转）
  // 对齐 react 版 order-detail.tsx：订单号经 sessionStorage('order-detail-id') 传入（orders-drawer
  // 以同键同时机写入，URL 不带 id 参数；隐藏路由经 meta.parent 归入订单父页签，仅用于面包屑）。
  // 数据挂载时经 getOrder(id) 拉取（react 版 query 缓存同语义），查无 id 显示空态；
  // 流程成功后 setOrder(updated)（react 版失效重取的可观察结果）即最新状态驱动全部动态区。
  import { onMount } from 'svelte'
  import '../styles/pages/orders.css'
  type OrderRow = import('../data/orders').OrderRow
  type OrderStatus = import('../data/orders').OrderStatus
  import { getOrder, updateOrderStatus } from '../data/orders'
  import { appMessage } from '../lib/app-message'
  import { useT } from '../lib/use-t.svelte'
  import { navigate } from '../router'
  import { statusLabel, tagTypeFor } from './orders-shared'

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  /** vanilla FLOW_STEPS / FLOW_TO：流转顺序与下一步映射 */
  const FLOW_STEPS: OrderStatus[] = ['pending', 'paid', 'shipping', 'done']
  const FLOW_TO: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: 'paid',
    paid: 'shipping',
    shipping: 'done',
  }

  function flowFor(
    status: OrderStatus,
  ): { label: string; to: OrderStatus } | undefined {
    const to = FLOW_TO[status]
    return to ? { label: tt(`orders.flow.${status}`), to } : undefined
  }

  /** vanilla formatMoney（详情页版本：两位小数、无空格——与列表页金额格式刻意不同，逐字对齐） */
  function formatMoney(n: number): string {
    return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  /** vanilla addDays：yyyy-MM-dd 加 n 天 */
  function addDays(dateStr: string, n: number): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + n)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${mm}-${dd}`
  }

  interface TimelineNode {
    time: string
    title: string
    color?: string
  }

  /** vanilla buildTimeline：创建 → 已按状态推进的各节点（取消态只有取消节点） */
  function buildTimeline(order: OrderRow): TimelineNode[] {
    const nodes: TimelineNode[] = [
      { time: order.created, title: tt('orderDetail.timeline.created') },
    ]
    if (order.status === 'cancelled') {
      nodes.push({
        time: addDays(order.created, 1),
        title: statusLabel('cancelled', tt),
        color: 'red',
      })
      return nodes
    }
    const idx = FLOW_STEPS.indexOf(order.status)
    if (idx >= 1) nodes.push({ time: addDays(order.created, 1), title: statusLabel('paid', tt) })
    if (idx >= 2)
      nodes.push({ time: addDays(order.created, 2), title: statusLabel('shipping', tt) })
    if (idx >= 3)
      nodes.push({
        time: addDays(order.created, 3),
        title: statusLabel('done', tt),
        color: 'green',
      })
    return nodes
  }

  // 快照读取：与 react 版一致，组件初始化时一次性固化（pageKey 重挂载即重新读取）
  const id = sessionStorage.getItem('order-detail-id') ?? ''

  let order = $state<OrderRow | null>(null)
  let loaded = $state(false)
  // loading 用存在性语义：oas-button 纯 attribute 驱动（原型无 loading 存取器），
  // 布尔 false 会落成 loading="false" 仍被判为 loading——须 {flowing ? '' : null}
  let flowing = $state(false)

  onMount(() => {
    void (async () => {
      const data = await getOrder(id)
      order = data
      loaded = true
    })()
  })

  const missing = $derived(loaded && order === null)
  const flow = $derived(order ? flowFor(order.status) : undefined)
  const steps = $derived(
    order && order.status !== 'cancelled'
      ? FLOW_STEPS.map((s) => ({ title: statusLabel(s, tt) }))
      : null,
  )
  const timeline = $derived(order ? buildTimeline(order) : [])

  async function onAction(): Promise<void> {
    if (!order || !flow || flowing) return
    flowing = true
    try {
      const updated = await updateOrderStatus(order.id, flow.to)
      if (!updated) {
        appMessage.error(tt('orders.notFound'))
        return
      }
      appMessage.success(tt('orders.flowApplied', { action: tt(`orders.flow.${order.status}`) }))
      order = updated
    } finally {
      flowing = false
    }
  }

  const note = $derived(
    !order
      ? ''
      : order.status === 'done'
        ? tt('orders.noteDone')
        : tt('orders.noteCancelled'),
  )

  let phEl: HTMLElement | null = $state(null)
  // title 命中 HTMLElement.prototype.title，oas-* 元素上的 title 必须走 setAttribute 通道
  $effect(() => {
    phEl?.setAttribute('title', order ? order.id : tt('nav.orderDetail'))
  })
</script>

<div class="page order-detail-page">
  <oas-page-header
    bind:this={phEl}
    data-testid="order-page-header"
    class="order-detail-ph"
  >
    <div slot="extra" class="ph-extra">
      <a
        class="link-btn"
        data-testid="order-back"
        href="#/orders"
        onclick={(e) => {
          e.preventDefault()
          navigate('/orders')
        }}>{tt('orderDetail.backList')}</a
      >
      {#if order}
        <oas-tag
          data-testid="order-status-tag"
          type={tagTypeFor(order.status) === 'purple' ? undefined : tagTypeFor(order.status)}
          color={tagTypeFor(order.status) === 'purple' ? 'purple' : undefined}
        >
          {statusLabel(order.status, tt)}
        </oas-tag>
      {:else}
        <oas-tag data-testid="order-status-tag">{tt('orderDetail.loading')}</oas-tag>
      {/if}
    </div>
  </oas-page-header>
  <div id="order-detail-card" hidden={missing}>
    <oas-card>
      {#if steps && order}
        <div id="order-detail-steps">
          <oas-steps
            class="order-steps"
            steps={JSON.stringify(steps)}
            current={FLOW_STEPS.indexOf(order.status)}
          ></oas-steps>
        </div>
      {/if}
      <oas-descriptions data-testid="order-detail-basic" id="order-detail-basic" column="2">
        <oas-descriptions-item label={tt('orders.th.customer')}>
          {order?.customer ?? ''}
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('orders.th.amount')}>
          <span class="mono">{order ? formatMoney(order.amount) : ''}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('form.label.phone')}>
          <span class="mono">{order?.phone ?? '-'}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('form.summary.urgent')}>
          {#if order}
            {order.urgent ? tt('form.label.urgent') : tt('form.summary.normalDelivery')}
          {/if}
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('orders.th.created')}>
          <span class="mono">{order?.created ?? ''}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('orders.th.items')}>
          {#each order?.items ?? [] as it, i (`${it}-${i}`)}
            <oas-tag>{it}</oas-tag>
          {/each}
        </oas-descriptions-item>
      </oas-descriptions>
      <div class="order-timeline-head">{tt('orderDetail.timelineTitle')}</div>
      <div id="order-detail-timeline-wrap">
        <oas-timeline data-testid="order-detail-timeline">
          {#each timeline as n, i (`${n.time}-${i}`)}
            <oas-timeline-item time={n.time} color={n.color}>{n.title}</oas-timeline-item>
          {/each}
        </oas-timeline>
      </div>
      <div class="order-detail-foot">
        {#if flow}
          <oas-button
            data-testid="order-detail-action"
            type="primary"
            loading={flowing ? '' : null}
            data-target={flow.to}
            onclick={onAction}
          >
            {flow.label}
          </oas-button>
        {/if}
        {#if !flow}
          <div class="order-detail-note" id="order-detail-note">{note}</div>
        {/if}
      </div>
    </oas-card>
  </div>
  {#if missing}
    <div id="order-detail-missing">
      <oas-empty description={tt('orderDetail.missing')}></oas-empty>
    </div>
  {/if}
</div>
