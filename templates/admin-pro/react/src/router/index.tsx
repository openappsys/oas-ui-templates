// src/router/index.tsx —— HashRouter/BrowserRouter + 守卫 + 布局路由组装
// 未登录：仅暴露 /login（LoginPage 直接 import 不懒加载，首屏要快）
// 已登录：AppShell 布局路由 + Guarded 逐条校验（forbidden/not-found 重定向）
// 路由模式：按 localStorage（oas-admin.router-mode）二选一（Task 6 设置中心可切换，
// 切换二次确认后整页刷新，此处模块加载时一次性定型）
import { useSyncExternalStore } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AppShell } from '../components/app-shell'
import LoginPage from '../pages/login'
import { session } from '../store/session'
import { guard } from './guard'
import { ROUTER_BASENAME, routerMode } from './mode'
import { appRoutes, type AppRoute } from './routes'

const ROUTER_MODE = routerMode()
const Router = ROUTER_MODE === 'history' ? BrowserRouter : HashRouter
// basename 仅 history 模式适用（服务端子路径）；HashRouter 的 basename 指 hash 内部路径（#/ 后的 /），
// 传入服务端 base 会与 #/ 解析出的 pathname 永不匹配 → Router 拒绝渲染白屏
// （门户 pnpm dev 以 --base /admin-pro/react/ 挂子路径时实测踩中）
const BASENAME = ROUTER_MODE === 'history' ? ROUTER_BASENAME : undefined

function Guarded({ route }: { route: AppRoute }) {
  const user = useSyncExternalStore(session.subscribe, () => session.user)
  const result = guard(route.path, user)
  if (!result.ok && result.reason === 'forbidden') return <Navigate to="/forbidden" replace />
  if (!result.ok && result.reason === 'not-found') return <Navigate to="/not-found" replace />
  return <route.Component />
}

/** 已登录兜底：未知路径 → /not-found（对齐 vue 版 /:pathMatch(.*)* 重定向）。
 *  例外：URL 停在 /login 的登录瞬移窗口（session 更新后、login.tsx 手动 navigate 前，
 *  见 login.tsx 偏差记录 5）保持原「匹配落空渲染 null」行为，否则兜底抢跑致登录后落错页 */
function NotFoundRedirect() {
  const { pathname } = useLocation()
  if (pathname === '/login') return null
  return <Navigate to="/not-found" replace />
}

export function AppRouter() {
  const user = useSyncExternalStore(session.subscribe, () => session.user)
  if (!user) {
    return (
      <Router basename={BASENAME}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    )
  }
  return (
    <Router basename={BASENAME}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {appRoutes
            .filter((r) => r.path !== '/login')
            .map((r) => (
              <Route key={r.path} path={r.path} element={<Guarded route={r} />} />
            ))}
          {/* 兜底：对齐 vue 版 /:pathMatch(.*)* → /not-found（React Router 匹配不到会渲染 null 白屏，
              如 dashboard 快捷操作指向子集路由表不存在的 /form、/orders，hash/history 两模式同理） */}
          <Route path="*" element={<NotFoundRedirect />} />
        </Route>
      </Routes>
    </Router>
  )
}
