import { liveQuery, type Subscription } from 'dexie'

export interface Observer<T> {
  next(value: T): void
  error?(error: unknown): void
}

export interface Observable<T> {
  subscribe(observer: Observer<T>): () => void
}

export function fromLiveQuery<T>(querier: () => T | Promise<T>): Observable<T> {
  return {
    subscribe(observer: Observer<T>): () => void {
      const sub: Subscription = liveQuery(querier).subscribe({
        next: (v) => observer.next(v),
        error: (e) => observer.error?.(e),
      })
      return () => sub.unsubscribe()
    },
  }
}
