import { useEffect, useRef } from 'react'

/** oas-* 表单类组件的 React 包装：value/options 走 property，oas-change 走 addEventListener */
export function OSelect({
  testid,
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  title,
  disabled,
  elRef,
}: {
  testid: string
  value: string
  options: Array<{ label: string; value: string }>
  onChange: (v: string) => void
  ariaLabel?: string
  /** 空值态提示（触发器的可见文案） */
  placeholder?: string
  /** 悬停提示：宿主 title 走 attribute（React 19 对 HTMLElement 命中的全局属性走 property，不落 attribute） */
  title?: string
  disabled?: boolean
  /** 需要程序性复位显示（如「选完即清回占位」）时由调用方持有宿主引用 */
  elRef?: React.RefObject<HTMLElement | null>
}) {
  const innerRef = useRef<HTMLElement>(null)
  const ref = elRef ?? innerRef
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    const el = ref.current
    if (!el) return
    ;(el as unknown as { options: unknown }).options = options
  }, [options, ref])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.toggleAttribute('disabled', disabled ?? false)
  }, [disabled, ref])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    ;(el as unknown as { value: string }).value = value
  }, [value, ref])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = (e: Event) => {
      const v = (e as CustomEvent<{ value: string }>).detail?.value
      if (typeof v === 'string') onChangeRef.current(v)
    }
    el.addEventListener('oas-change', h)
    return () => el.removeEventListener('oas-change', h)
  }, [ref])
  // oas-select 只在内部 trigger 上写 aria-label（来源是 `label` attribute，placeholder 兜底）；
  // 宿主 aria-label 不会穿过 shadow，所以要显式写 attribute 才真正命名 combobox
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (ariaLabel) el.setAttribute('label', ariaLabel)
    else el.removeAttribute('label')
  }, [ariaLabel, ref])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (title) el.setAttribute('title', title)
    else el.removeAttribute('title')
  }, [title, ref])
  return (
    <oas-select ref={ref} placeholder={placeholder} data-testid={testid} aria-label={ariaLabel} />
  )
}

/** oas-select 多选包装（multiple + searchable + clearable）：options / value 走 property
 *  （多选时 setter 把数组转 JSON 写 value attribute）；`multiple` 决定 setter 语义，
 *  必须在写 value 之前就在场——由 JSX attribute 保证（property 写入是 effect 的事）。
 *  oas-change detail.value 为数组，clearable 清空路径回调空数组 = 该维度不限；
 *  max-tag-count 让已选项折叠成 +N，避免 chips 把工具条撑开。 */
export function OMultiSelect({
  testid,
  value,
  options,
  placeholder,
  label,
  searchLabel,
  disabled,
  maxTagCount = 2,
  onChange,
}: {
  testid: string
  value: string[]
  options: Array<{ label: string; value: string }>
  placeholder?: string
  /** 可访问名：同时写宿主 aria-label 与 `label` attribute（oas-select 的 combobox 只认后者） */
  label?: string
  /** 下拉搜索框的可访问名与占位提示：组件自身按库内 i18n 命名且每次 update 重置 aria-label，
   *  故在展开时覆盖一次（此后不再被 update 触碰，直到下次 rebuild） */
  searchLabel?: string
  disabled?: boolean
  maxTagCount?: number
  onChange: (v: string[]) => void
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
    ;(el as unknown as { value: string | string[] }).value = value
  }, [value])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = (e: Event) => {
      const v = (e as CustomEvent<{ value?: unknown }>).detail?.value
      if (Array.isArray(v)) onChangeRef.current(v.map(String))
      // 单选契约的兜底（组件在非 multiple 形态下 detail.value 是字符串）
      else if (typeof v === 'string') onChangeRef.current(v === '' ? [] : [v])
    }
    el.addEventListener('oas-change', h)
    return () => el.removeEventListener('oas-change', h)
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (label) el.setAttribute('label', label)
    else el.removeAttribute('label')
  }, [label])
  useEffect(() => {
    const el = ref.current
    if (!el || !searchLabel) return
    const h = (e: Event) => {
      if (!(e as CustomEvent<{ open?: boolean }>).detail?.open) return
      const input = el.shadowRoot?.querySelector('.search-input')
      input?.setAttribute('aria-label', searchLabel)
      input?.setAttribute('placeholder', searchLabel)
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
  }, [searchLabel])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 选项 label 的计数后缀只服务于「挑人」；触发器 chip 是已选身份，剥掉后缀把宽度留给更多 chip
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ label?: string; element?: HTMLElement }>).detail
      if (d?.element && d.label) d.element.textContent = d.label.replace(/\s*\(\d+\)$/, '')
    }
    el.addEventListener('oas-tag-render', h)
    return () => el.removeEventListener('oas-tag-render', h)
  }, [])
  return (
    <oas-select
      ref={ref}
      multiple=""
      searchable=""
      clearable=""
      max-tag-count={String(maxTagCount)}
      placeholder={placeholder}
      aria-label={label}
      data-testid={testid}
    />
  )
}

export function OCheckbox({
  testid,
  className,
  checked,
  disabled,
  ariaLabel,
  onChange,
}: {
  testid: string
  className?: string
  checked: boolean
  disabled?: boolean
  /** 可访问名：走默认 slot（shadow 内的 <label><slot> 即名字来源），视觉上由 .sr-only 隐藏 */
  ariaLabel?: string
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
  return (
    <oas-checkbox ref={ref} size="small" className={className} data-testid={testid}>
      {ariaLabel && <span className="sr-only">{ariaLabel}</span>}
    </oas-checkbox>
  )
}

/** oas-date-picker 包装（type=date）：value 走 property 受控写（'YYYY-MM-DD'，空串=已清），
 *  oas-change detail {value}；clearable 清空组件内部 clearValue 已连发 oas-clear + oas-change
 *  （空值）——只监听 oas-change，挂 oas-clear 会双发 onChange('') */
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
    el.addEventListener('oas-change', h)
    return () => {
      el.removeEventListener('oas-change', h)
    }
  }, [])
  return <oas-date-picker ref={ref} type="date" clearable="" data-testid={testid} />
}

/** oas-time-picker 包装（单值 'HH:mm'）：value 走 property 受控写（dist 契约：set value 强制
 *  应用且不派发事件）；presets 走 property（d.ts 明示 @apiProperty，快捷时刻 {label,value}[]）；
 *  oas-change detail {value}——clear 路径组件内部连发 oas-clear + oas-change（空值），
 *  只挂 oas-change 防双发（同 ODatePicker 先例） */
export function OTimePicker({
  testid,
  value,
  presets,
  disabled,
  onChange,
}: {
  testid: string
  value: string
  presets?: Array<{ label: string; value: string }>
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
    ;(el as unknown as { presets: unknown }).presets = presets ?? null
  }, [presets])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = (e: Event) => {
      const v = (e as CustomEvent<{ value?: unknown }>).detail?.value
      if (typeof v === 'string') onChangeRef.current(v)
    }
    el.addEventListener('oas-change', h)
    return () => el.removeEventListener('oas-change', h)
  }, [])
  return <oas-time-picker ref={ref} format="HH:mm" data-testid={testid} />
}

/** oas-segmented 包装：options 与 value 都走 setAttribute（渲染签名只认 attribute，
 *  property setter 不触发重建——AGENTS 已知坑）；oas-change detail {value} */
export function OSegmented({
  testid,
  value,
  options,
  ariaLabel,
  disabled,
  onChange,
}: {
  testid: string
  value: string
  options: Array<{ label: string; value: string }>
  /** 可访问名：radiogroup 在 shadow 内，不转发宿主 aria-label——显式写到内部 group 上 */
  ariaLabel?: string
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
    if (el.shadowRoot && ariaLabel) {
      el.shadowRoot.querySelector('[part="group"]')?.setAttribute('aria-label', ariaLabel)
    }
  }, [ariaLabel])
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
  ariaLabel,
  onChange,
}: {
  testid: string
  value: string
  options: Array<{ label: string; value: string }>
  /** 可访问名：写到宿主 aria-label（oas-tabs 不转发到 shadow 内的 tablist，见审计遗留项） */
  ariaLabel?: string
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
    <oas-tabs
      ref={ref}
      tab-position="left"
      size="small"
      hide-content=""
      aria-label={ariaLabel}
      data-testid={testid}
    />
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
