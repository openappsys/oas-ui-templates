import { useEffect, useState } from 'react'
import type { Observable } from './observable'

export interface ObservableState<T> {
  value: T | undefined
  /** 最近一次订阅期内的错误；已有数据时保留旧值（轮询失败不闪空） */
  error: unknown
}

/** 订阅 Observable 并保留错误：首次加载失败要能被界面看见（列表错误态 + 重试）。
 *  重试 = 调用方改 deps（把 retryNonce 放进去）→ 重新订阅，error 复位 */
export function useObservableState<T>(
  factory: () => Observable<T>,
  deps: unknown[],
): ObservableState<T> {
  const [state, setState] = useState<ObservableState<T>>({ value: undefined, error: undefined })
  useEffect(() => {
    // 重订阅（含重试）时清掉上一次的错误，界面回到加载态而不是停在错误态
    setState((prev) => (prev.error === undefined ? prev : { value: undefined, error: undefined }))
    const unsub = factory().subscribe({
      next: (value) => setState({ value, error: undefined }),
      error: (error) => {
        console.error('[useObservable]', error)
        setState((prev) => ({ value: prev.value, error }))
      },
    })
    return unsub
    // biome-ignore lint/correctness/useExhaustiveDependencies: 通用订阅封装，依赖由调用方按 factory 闭包内容显式声明
  }, deps)
  return state
}

export function useObservable<T>(factory: () => Observable<T>, deps: unknown[]): T | undefined {
  return useObservableState(factory, deps).value
}
