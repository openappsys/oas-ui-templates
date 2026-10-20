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

export function OCheckbox({
  testid,
  className,
  checked,
  disabled,
  onChange,
}: {
  testid: string
  className?: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.toggleAttribute('checked', checked)
  }, [checked])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.toggleAttribute('disabled', disabled ?? false)
  }, [disabled])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = () => onChangeRef.current()
    el.addEventListener('oas-change', h)
    const c = (e: Event) => {
      e.stopPropagation()
    }
    el.addEventListener('click', c)
    return () => {
      el.removeEventListener('oas-change', h)
      el.removeEventListener('click', c)
    }
  }, [])
  return <oas-checkbox ref={ref} size="small" className={className} data-testid={testid} />
}

/** oas-date-picker 包装（type=date）：value 走 property 受控写（'YYYY-MM-DD'，空串=已清），
 *  oas-change detail {value}；clearable 清空额外派发 oas-clear → onChange('') */
export function ODatePicker({
  testid,
  value,
  disabled,
  onChange,
}: {
  testid: string
  value: string
  disabled?: boolean
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
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
      const v = (e as CustomEvent<{ value?: string }>).detail?.value
      if (typeof v === 'string') onChangeRef.current(v)
    }
    const clear = () => onChangeRef.current('')
    el.addEventListener('oas-change', h)
    el.addEventListener('oas-clear', clear)
    return () => {
      el.removeEventListener('oas-change', h)
      el.removeEventListener('oas-clear', clear)
    }
  }, [])
  return <oas-date-picker ref={ref} type="date" clearable="" data-testid={testid} />
}

/** oas-segmented 包装：options 与 value 都走 setAttribute（渲染签名只认 attribute，
 *  property setter 不触发重建——AGENTS 已知坑）；oas-change detail {value} */
export function OSegmented({
  testid,
  value,
  options,
  disabled,
  onChange,
}: {
  testid: string
  value: string
  options: Array<{ label: string; value: string }>
  disabled?: boolean
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const optionsJson = JSON.stringify(options.map((o) => ({ label: o.label, value: o.value })))
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
    el.setAttribute('value', value)
  }, [value])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.toggleAttribute('disabled', disabled ?? false)
  }, [disabled])
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
  return <oas-segmented ref={ref} size="small" data-testid={testid} />
}

/** oas-tabs 包装（侧栏视图切换）：items 走 attribute JSON，active 走 attribute，
 *  oas-change（detail {value}）与 segmented 同契约——testid 沿用 view-seg，e2e 无感切换 */
export function OTabs({
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
  const itemsJson = JSON.stringify(options.map((o) => ({ label: o.label, value: o.value })))
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.setAttribute('items', itemsJson)
  }, [itemsJson])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.setAttribute('active', value)
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
  return (
    <oas-tabs ref={ref} tab-position="left" size="small" hide-content="" data-testid={testid} />
  )
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
