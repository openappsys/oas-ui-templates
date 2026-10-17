import { useEffect, useRef } from 'react'

/** oas-* 表单类组件的 React 包装：value/options 走 property，oas-change 走 addEventListener */
export function OSelect({
  testid,
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
}: {
  testid: string
  value: string
  options: Array<{ label: string; value: string }>
  onChange: (v: string) => void
  ariaLabel?: string
  disabled?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    const el = ref.current
    if (!el) return
    ;(el as unknown as { options: unknown }).options = options
  }, [options])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.toggleAttribute('disabled', disabled ?? false)
  }, [disabled])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    ;(el as unknown as { value: string }).value = value
  }, [value])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = (e: Event) => {
      const v = (e as CustomEvent<{ value: string }>).detail?.value
      if (typeof v === 'string') onChangeRef.current(v)
    }
    el.addEventListener('oas-change', h)
    return () => el.removeEventListener('oas-change', h)
  }, [])
  return <oas-select ref={ref} data-testid={testid} aria-label={ariaLabel} />
}

/** oas-segmented 包装。
 *  注意：segmented 的渲染签名只看 options attribute（property setter 仅存内存不触发重建），
 *  必须走 attribute JSON 通道。 */
export function OSegmented({
  testid,
  value,
  options,
  onChange,
}: {
  testid: string
  value: string
  options: Array<{ label: string; value: string }>
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const optionsJson = JSON.stringify(options)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.setAttribute('options', optionsJson)
  }, [optionsJson])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    ;(el as unknown as { value: string }).value = value
  }, [value])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = (e: Event) => {
      const v = (e as CustomEvent<{ value: string }>).detail?.value
      if (typeof v === 'string') onChangeRef.current(v)
    }
    el.addEventListener('oas-change', h)
    return () => el.removeEventListener('oas-change', h)
  }, [])
  return <oas-segmented ref={ref} block size="small" data-testid={testid} />
}

/** oas-tag closable 包装：oas-close 事件 → onRemove */
export function TagChip({
  label,
  testid,
  onRemove,
}: {
  label: string
  testid?: string
  onRemove: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const onRemoveRef = useRef(onRemove)
  onRemoveRef.current = onRemove
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = (e: Event) => {
      e.preventDefault()
      onRemoveRef.current()
    }
    el.addEventListener('oas-close', h)
    return () => el.removeEventListener('oas-close', h)
  }, [])
  return (
    <oas-tag ref={ref} closable data-testid={testid}>
      {label}
    </oas-tag>
  )
}
