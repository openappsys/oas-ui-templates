<script setup lang="ts">
// src/pages/logs-vlist.vue —— 日志虚拟列表（oas-virtual-list 封装：行模板 + items 注入 + 行回填）
// 行为事实来源：vanilla-html/src/pages/logs.ts 的 template[slot=item]/renderVirtualList/
// scrollToIndex/oas-item 段（
// 拆分边界：logs.vue 主文件 ≤400 行纪律，锚点联动留在父组件）
// 偏差记录（因果链）：
// 1. 行模板：oas-virtual-list 读取子节点 template[slot="item"]（shadow 容器约定）；Vue 编译器
//    对 template 元素有特殊处理，故 onMounted 命令式创建并 appendChild（与 vanilla 第 128-156
//    行逐字一致），oas-item 事件回填单元格 + 行 click 上抛 open-detail（vanilla 同款时机）
// 2. items 数据：vanilla property 赋值 (vlist as {items}).items = filtered；本模版在
//    watch([rows, locale], flush:'post') 里走同一 property 通道（数据变化与语言切换都重建行）
// 3. 回顶时机：vanilla applyFilter 尾部 resetScroll、refreshText 里 renderVirtualList 不回顶
//    （语言切换保持滚动位置）；本模版数据 watch 回顶、语言 watch 不回顶，语义一一对应
// 4. 级别标签配色：vanilla LEVEL_TAG（info=default/warn=warning/error=danger）
import { onMounted, ref, watch } from 'vue'
import type { LogEntry, LogLevel } from '../data/logs'
import { useT } from '../composables/use-t'

const props = defineProps<{
  rows: LogEntry[]
  /** 筛选结果为空：列表隐藏（空态 overlay 由父组件显示） */
  empty: boolean
}>()
const emit = defineEmits<{
  'open-detail': [entry: LogEntry]
  /** oas-scroll 透传给父组件做锚点 active 联动 */
  scroll: []
}>()

const { t: tt, locale } = useT()

const ITEM_HEIGHT = 44

// vanilla LEVEL_TAG
const LEVEL_TAG: Record<LogLevel, string> = {
  info: 'default',
  warn: 'warning',
  error: 'danger',
}

function levelLabel(level: LogLevel): string {
  return tt(`logs.level.${level}`)
}

function formatTime(time: string): string {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const vlistRef = ref<HTMLElement | null>(null)

// vanilla renderVirtualList：items 走 property 通道；数据/语言变化都重建行
watch(
  [() => props.rows, locale, vlistRef],
  () => {
    const vlist = vlistRef.value as (HTMLElement & { items?: LogEntry[] }) | null
    if (vlist) vlist.items = props.rows
  },
  { flush: 'post' },
)

// vanilla applyFilter 尾部的 resetScroll：仅数据集变化回顶（语言切换保持滚动位置）
watch(
  () => props.rows,
  () => {
    resetScroll()
  },
  { flush: 'post' },
)

// 虚拟列表行模板：命令式创建 template[slot="item"]（内容与 vanilla 第 130-155 行逐字一致）
// buffer 同为命令式 setAttribute：组件原型有 buffer() 方法（读 attribute 的访问器），Vue 对
// 「el 上存在同名 property（含原型方法）」的 attribute 走 property 赋值，会遮蔽方法导致
// this.buffer is not a function（item-height 等 kebab 属性不受影响）
onMounted(() => {
  const vlist = vlistRef.value
  if (!vlist) return
  vlist.setAttribute('buffer', '8')
  const template = document.createElement('template')
  template.setAttribute('slot', 'item')
  template.innerHTML = `
    <style>
      .logs-cell {
        font-size: var(--oas-font-size-sm);
        color: var(--oas-color-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .logs-cell.mono {
        font-family: var(--app-mono);
      }
      .logs-cell.logs-time {
        color: var(--oas-color-text-secondary);
      }
      @media (max-width: 768px) {
        .logs-cell {
          font-size: var(--oas-font-size-xs);
        }
      }
    </style>
    <span class="logs-cell logs-time mono" data-col="time"></span>
    <span class="logs-cell logs-level" data-col="level"><oas-tag size="small"></oas-tag></span>
    <span class="logs-cell logs-operator" data-col="operator"></span>
    <span class="logs-cell logs-action" data-col="action"></span>
    <span class="logs-cell logs-ip mono" data-col="ip"></span>`
  vlist.appendChild(template)
})

// vanilla oas-item 回调：回填单元格 + 级别标签 + 行点击上抛
function onItem(e: Event): void {
  const { item, element } = (e as CustomEvent<{ item: LogEntry; element: HTMLElement }>).detail
  const row = item
  element.querySelector<HTMLElement>('[data-col="time"]')!.textContent = formatTime(row.time)
  const tag = element.querySelector('oas-tag')!
  tag.textContent = levelLabel(row.level)
  tag.setAttribute('type', LEVEL_TAG[row.level])
  element.querySelector<HTMLElement>('[data-col="operator"]')!.textContent = row.operator
  element.querySelector<HTMLElement>('[data-col="action"]')!.textContent = row.action
  element.querySelector<HTMLElement>('[data-col="ip"]')!.textContent = row.IP
  element.addEventListener('click', () => emit('open-detail', row))
}

// vanilla scrollToIndex：shadow 内 .viewport.scrollTop = index * 行高
function scrollToIndex(index: number): void {
  const vlist = vlistRef.value as (HTMLElement & { shadowRoot: ShadowRoot }) | null
  const viewport = vlist?.shadowRoot.querySelector<HTMLElement>('.viewport')
  if (!viewport) return
  viewport.scrollTop = Math.max(0, index * ITEM_HEIGHT)
}

function resetScroll(): void {
  scrollToIndex(0)
}

// 锚点联动取数：滚动位置换算当前可见行 index（父组件据此反查日期 → anchor active）
function currentScrollIndex(): number {
  const vlist = vlistRef.value as (HTMLElement & { shadowRoot: ShadowRoot }) | null
  const viewport = vlist?.shadowRoot.querySelector<HTMLElement>('.viewport')
  if (!viewport) return 0
  return Math.floor(viewport.scrollTop / ITEM_HEIGHT)
}

defineExpose({ scrollToIndex, resetScroll, currentScrollIndex })
</script>

<template>
  <oas-virtual-list
    ref="vlistRef"
    data-testid="logs-list"
    id="logs-list"
    height="480"
    :item-height="ITEM_HEIGHT"
    :hidden="empty"
    @oas-item="onItem"
    @oas-scroll="emit('scroll')"
  />
</template>
