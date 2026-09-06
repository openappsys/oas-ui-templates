// src/lib/session-actions.ts —— 登出闭环：清会话 + 提示 + 回首页
// 与 react 版逐字一致；navigate 由调用方包一层 vue-router 的 push（返回 Promise，此处按 void 语义）
import type { Router } from 'vue-router'
import { t } from '../i18n'
import { appRoutes } from '../router/routes'
import { session } from '../store/session'
import { appMessage } from './app-message'

export function logoutFlow(navigate: (path: string) => void): void {
  session.logout()
  appMessage.info(t('header.loggedOut'))
  // 登出后守卫会把受保护路径重定向到 /login，先把路径归位首页避免残留受保护路径
  navigate(appRoutes[0].path)
}

/** vue-router 适配的登出导航：同路径 push 是冗余导航、不会重评 beforeEach 守卫，
 *  若已在首页需直接导航 /login 让壳卸载（react 版由 user 状态驱动路由树分支天然接管，无此问题） */
export function logoutNavigate(router: Router): void {
  logoutFlow((p) => {
    const target = p === router.currentRoute.value.path ? '/login' : p
    void router.push(target)
  })
}
