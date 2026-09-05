// src/lib/session-actions.ts —— 登出闭环：清会话 + 提示 + 回首页
// 头部用户菜单与命令面板共用（对齐 vanilla app-shell.ts userMenu/execCommand 的 logout 分支）
import { t } from '../i18n'
import { appRoutes } from '../router/routes'
import { session } from '../store/session'
import { appMessage } from './app-message'

export function logoutFlow(navigate: (path: string) => void): void {
  session.logout()
  appMessage.info(t('header.loggedOut'))
  // 登出后路由树切到未登录分支（* → /login），先把 hash 归位首页避免残留受保护路径
  navigate(appRoutes[0].path)
}
