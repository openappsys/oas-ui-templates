// src/lib/session-actions.ts —— 登出闭环：清会话 + 提示 + 回首页
import { t } from '../i18n'
import { navigate } from '../router'
import { HOME_PATH } from '../router/tabs'
import { session } from '../store/session'
import { appMessage } from './app-message'

export function logoutFlow(): void {
  session.logout()
  appMessage.info(t('header.loggedOut'))
  // 登出后守卫把受保护路径弹回 /login，先把地址归位首页避免残留受保护路径
  navigate(HOME_PATH)
}
