import type { IssuePriority } from '@/types'

export const PRIORITY_WEIGHT: Record<IssuePriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/** fractional order：在 prev/next 之间取中值（浮点），边界用 ±1024 步进 */
export function betweenOrder(prev?: number, next?: number): number {
  if (prev == null && next == null) return 0
  if (prev == null) return (next as number) - 1024
  if (next == null) return prev + 1024
  return (prev + next) / 2
}
