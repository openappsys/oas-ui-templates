<script lang="ts">
  // src/pages/logs-vlist.svelte —— 日志虚拟列表（oas-virtual-list 封装：行模板 + items 注入 + 行回填）
  // 对齐 react 版 logs.tsx 虚拟列表段 / vue 版 logs-vlist.vue：
  // 1. 行模板：oas-virtual-list 读取子节点 template[slot="item"]（shadow 容器约定）；
  //    模板含原生 <style> 隔离样式与 data-col 占位单元格，oas-item 事件里逐列回填
  // 2. items 走 property 通道（bind:this + $effect，数据变化与语言切换都重建行）；
  //    本模版数据变化回顶（vanilla applyFilter→resetScroll 同款）、语言切换保持滚动位置
  // 3. buffer 必须走 setAttribute 通道：oas-virtual-list 原型上的 buffer() 是方法，
  //    property 通道赋 number 会把方法遮蔽成数据致 this.buffer is not a function（实测崩溃）
  import { onMount } from 'svelte'
  type LogEntry = import('../data/logs').LogEntry
  import { useT } from '../lib/use-t.svelte'
  import { formatTime, ITEM_HEIGHT, ITEM_TEMPLATE_HTML, LEVEL_TAG, levelLabel } from './logs-shared'

  interface Props {
    rows: LogEntry[]
    /** 筛选结果为空：列表隐藏（空态 overlay 由父组件显示） */
    empty: boolean
    onOpenDetail: (entry: LogEntry) => void
    /** oas-scroll 透传给父组件做锚点 active 联动 */
    onScroll: () => void
  }

  let { rows, empty, onOpenDetail, onScroll }: Props = $props()

  const { t, locale } = useT()

  let vlistEl: HTMLElement | null = $state(null)

  // items 走 property 通道；随 rows/locale 变化重新注入（组件库 setter 内部 slice + update）
  $effect(() => {
    void $locale
    if (vlistEl) (vlistEl as HTMLElement & { items: LogEntry[] }).items = rows
  })

  // 数据变化回顶；语言切换不回顶（locale 变化只重建行）
  $effect(() => {
    if (rows) resetScroll()
  })

  onMount(() => {
    if (!vlistEl) return
    // buffer 走 attribute 通道（理由见文件头注释 3）
    vlistEl.setAttribute('buffer', '8')
    // 行模板：与 react 版 dangerouslySetInnerHTML / vue 版 createElement+innerHTML 同款注入
    const template = document.createElement('template')
    template.setAttribute('slot', 'item')
    template.innerHTML = ITEM_TEMPLATE_HTML
    vlistEl.appendChild(template)
  })

  /** oas-item：行节点回收复用时逐列回填，并直绑行 click 打开详情 */
  function onItem(e: Event): void {
    const { item, element } = (e as CustomEvent<{ item: LogEntry; element: HTMLElement }>).detail
    const row = item
    element.querySelector<HTMLElement>('[data-col="time"]')!.textContent = formatTime(row.time)
    const tag = element.querySelector('oas-tag')!
    tag.textContent = levelLabel(row.level, t)
    tag.setAttribute('type', LEVEL_TAG[row.level])
    element.querySelector<HTMLElement>('[data-col="operator"]')!.textContent = row.operator
    element.querySelector<HTMLElement>('[data-col="action"]')!.textContent = row.action
    element.querySelector<HTMLElement>('[data-col="ip"]')!.textContent = row.IP
    element.addEventListener('click', () => onOpenDetail(row))
  }

  /** 滚动到指定行号（锚点点击定位） */
  export function scrollToIndex(index: number): void {
    const viewport = (vlistEl as unknown as { shadowRoot: ShadowRoot } | null)?.shadowRoot.querySelector<HTMLElement>(
      '.viewport',
    )
    if (!viewport) return
    viewport.scrollTop = Math.max(0, index * ITEM_HEIGHT)
  }

  /** 数据变化回顶（vanilla applyFilter→resetScroll 同款） */
  export function resetScroll(): void {
    scrollToIndex(0)
  }

  /** 锚点联动取数：滚动位置换算当前可见行 index（父组件据此反查日期 → anchor active） */
  export function currentScrollIndex(): number {
    const viewport = (vlistEl as unknown as { shadowRoot: ShadowRoot } | null)?.shadowRoot.querySelector<HTMLElement>(
      '.viewport',
    )
    if (!viewport) return 0
    return Math.floor(viewport.scrollTop / ITEM_HEIGHT)
  }
</script>

<oas-virtual-list
  bind:this={vlistEl}
  data-testid="logs-list"
  id="logs-list"
  height="480"
  item-height={ITEM_HEIGHT}
  hidden={empty}
  onoas-item={onItem}
  onoas-scroll={onScroll}
></oas-virtual-list>
