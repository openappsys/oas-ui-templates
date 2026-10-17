import { useEffect, useRef } from 'react'

/** oas-chart：data/options 走 attribute（React 19 property 分派对 data 不可靠） */
export function Chart({
  type,
  data,
  options,
  testid,
  label,
}: {
  type: string
  data: unknown
  options?: Record<string, unknown>
  testid: string
  label: string
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.setAttribute('type', type)
    el.setAttribute('data', JSON.stringify(data))
    if (options) el.setAttribute('options', JSON.stringify(options))
    el.setAttribute('class', 'pm-chart')
  }, [type, data, options])
  return <oas-chart ref={ref} data-testid={testid} aria-label={label} data-className="pm-chart" />
}
