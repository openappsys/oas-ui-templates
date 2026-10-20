import { useEffect, useState } from 'react'
import type { Observable } from './observable'

export function useObservable<T>(factory: () => Observable<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined)
  useEffect(() => {
    const unsub = factory().subscribe({
      next: setValue,
      error: (e) => console.error('[useObservable]', e),
    })
    return unsub
    // biome-ignore lint/correctness/useExhaustiveDependencies: 通用订阅封装，依赖由调用方按 factory 闭包内容显式声明
  }, deps)
  return value
}
