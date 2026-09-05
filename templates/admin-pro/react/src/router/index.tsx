// src/router/index.tsx —— HashRouter/BrowserRouter + 守卫 + 布局路由组装
// 未登录：仅暴露 /login（LoginPage 直接 import 不懒加载，首屏要快）
// 已登录：AppShell 布局路由 + Guarded 逐条校验（forbidden/not-found 重定向）
// 路由模式：按 localStorage（oas-admin.router-mode）二选一（Task 6 设置中心可切换，
// 切换二次确认后整页刷新，此处模块加载时一次性定型）
import { useSyncExternalStore } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from '../components/app-shell'
import LoginPage from '../pages/login'
import { session } from '../store/session'
import { guard } from './guard'
import { ROUTER_BASENAME, routerMode } from './mode'
import { appRoutes, type AppRoute } from './routes'

const Router = routerMode() === 'history' ? BrowserRouter : HashRouter

function Guarded({ route }: { route: AppRoute }) {
  const user = useSyncExternalStore(session.subscribe, () => session.user)
  const result = guard(route.path, user)
  if (!result.ok && result.reason === 'forbidden') return <Navigate to="/forbidden" replace />
  if (!result.ok && result.reason === 'not-found') return <Navigate to="/not-found" replace />
  return <route.Component />
}

export function AppRouter() {
  const user = useSyncExternalStore(session.subscribe, () => session.user)
  if (!user) {
    return (
      <Router basename={ROUTER_BASENAME}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    )
  }
  return (
    <Router basename={ROUTER_BASENAME}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {appRoutes
            .filter((r) => r.path !== '/login')
            .map((r) => (
              <Route key={r.path} path={r.path} element={<Guarded route={r} />} />
            ))}
        </Route>
      </Routes>
    </Router>
  )
}
