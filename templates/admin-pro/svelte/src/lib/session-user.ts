// src/lib/session-user.ts —— session.user 的 readable 封装（组件经 fromStore 订阅）
import { readable } from 'svelte/store'
import { session, type User } from '../store/session'

export const sessionUser = readable<User | null>(session.user, (set) =>
  session.subscribe(() => set(session.user)),
)
