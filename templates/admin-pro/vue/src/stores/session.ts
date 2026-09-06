// src/stores/session.ts —— Pinia 会话 store：包装既有 session 单例
// login/logout 委托单例执行（localStorage 键名 oas-admin.session / oas-admin.session.loginAt
// 与持久化行为逐字不变），单例 subscribe 通知回写 store 响应式状态；
// 守卫/顶栏/命令面板/个人中心等消费方统一从本 store 取会话
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { session } from '../store/session'
import type { Role, User } from '../store/session'

export const useSessionStore = defineStore('session', () => {
  const user = ref<User | null>(session.user)
  const loginAt = ref<number | null>(session.loginAt)

  // 单例 subscribe → store state：保留原订阅语义，login/logout 后响应式状态同步更新
  session.subscribe(() => {
    user.value = session.user
    loginAt.value = session.loginAt
  })

  function login(name: string, role: Role): void {
    session.login(name, role)
  }

  function logout(): void {
    session.logout()
  }

  return { user, loginAt, login, logout }
})
