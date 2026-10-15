import { useState, useCallback, type ReactNode } from 'react'

interface VirtualListProps {
  count: number
  rowHeight: number
  height: number
  overscan?: number
  renderItem: (index: number) => ReactNode
}

/** 虚拟滚动：固定行高 + 绝对定位，100W 条 60fps */
export function VirtualList({
  count,
  rowHeight,
  height,
  overscan = 6,
  renderItem,
}: VirtualListProps) {
  const [scrollTop, setScrollTop] = useState(0)

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visible = Math.ceil(height / rowHeight) + overscan * 2
  const end = Math.min(count, start + visible)

  const items: ReactNode[] = []
  for (let i = start; i < end; i++) {
    items.push(
      <div
        key={i}
        style={{ position: 'absolute', top: i * rowHeight, left: 0, right: 0, height: rowHeight }}
      >
        {renderItem(i)}
      </div>,
    )
  }

  return (
    <div style={{ height, overflowY: 'auto' }} onScroll={onScroll}>
      <div style={{ height: count * rowHeight, position: 'relative' }}>{items}</div>
    </div>
  )
}
