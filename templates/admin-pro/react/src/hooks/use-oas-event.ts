import { useEffect, useRef } from 'react'

/** 绑定 oas-* 自定义事件（React 19 不会把 onXxx prop 绑到 kebab 事件，必须手动 addEventListener） */
export function useOasEvent<T = unknown>(
  ref: React.RefObject<HTMLElement | null>,
  type: string,
  handler: (detail: T, ev: Event) => void,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const listener = (ev: Event) => {
      handlerRef.current((ev as CustomEvent<T>).detail, ev)
    }
    el.addEventListener(type, listener)
    return () => el.removeEventListener(type, listener)
  }, [ref, type])
}
