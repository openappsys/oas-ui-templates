// src/router/index.tsx —— react-router v7 data APIs 组装：createHashRouter/createBrowserRouter + RouterProvider
// 守卫下沉到路由 loader（渲染前执行，replace() 重定向语义与旧 <Navigate replace> 一致）：
// 未登录 → /login、无权限 → /forbidden、未知路径 → /not-found；
// 登录态变化经 SessionSync 触发 revalidate，loader 重跑后守卫即时生效（登出立即弹回 /login）。
// 路由模式：按 localStorage（oas-admin.router-mode）模块加载时一次性定型，
// 设置中心切换走 modal.confirm + 整页刷新（applyRouterMode），此处不再感知。
import { useEffect } from 'react'
import {
  createBrowserRouter,
  createHashRouter,
  Outlet,
  replace,
  RouterProvider,
  useRevalidator,
} from 'react-router'
import { AppShell } from '../components/app-shell'
import LoginPage from '../pages/login'
import { session } from '../store/session'
import { guard } from './guard'
import { ROUTER_BASENAME, routerMode } from './mode'
import { appRoutes } from './routes'

const ROUTER_MODE = routerMode()

/** 未登录只暴露 /login：布局分支 loader 在渲染前拦截（取代旧「未登录独立路由树」分支） */
function requireAuth() {
  if (!session.user) return replace('/login')
  return null
}

/** 页面守卫 loader：guard() 纯函数三态结论换成重定向（guard 本体与单测保持不动） */
function guardLoader(path: string) {
  return () => {
    const result = guard(path, session.user)
    if (result.ok) return null
    if (result.reason === 'forbidden') return replace('/forbidden')
    if (result.reason === 'not-found') return replace('/not-found')
    return replace('/login')
  }
}

/** 登录态变化 → revalidate：当前匹配的 loader 重跑（无 loader 的 /login 不受影响） */
function SessionSync() {
  const revalidator = useRevalidator()
  useEffect(() => session.subscribe(() => revalidator.revalidate()), [revalidator])
  return null
}

function createAppRouter() {
  const routes = [
    {
      // 顶层无路径布局：挂 SessionSync（登录/登出后重校验 loader），兼作两分支公共父级
      element: (
        <>
          <SessionSync />
          <Outlet />
        </>
      ),
      children: [
        // 未登录分支：仅 /login（直接 import 不懒加载，首屏要快）
        { path: '/login', element: <LoginPage /> },
        {
          // 已登录分支：AppShell 布局路由（内部 <Outlet/>），loader 先拦未登录
          path: '/',
          element: <AppShell />,
          loader: requireAuth,
          children: [
            { index: true, loader: () => replace('/dashboard') },
            ...appRoutes
              .filter((r) => r.path !== '/login')
              .map((r) => ({
                path: r.path,
                loader: guardLoader(r.path),
                Component: r.Component,
              })),
            // 兜底：未知路径 → /not-found（对齐 vue 版 /:pathMatch(.*)* 重定向）。
            // 旧版「URL 停在 /login 的登录瞬移窗口」豁免不再需要：/login 已是顶层独立路由，
            // 且登录动作后的 revalidate 只重跑 /login 自身（无 loader），不会抢跑
            { path: '*', loader: () => replace('/not-found') },
          ],
        },
      ],
    },
  ]
  // basename 仅 history 模式适用（服务端子路径）；hash 模式的 basename 指 #/ 内部路径，
  // 传入服务端 base 会与解析出的 pathname 永不匹配 → 白屏（门户 --base 子路径实测踩中），勿回退
  return ROUTER_MODE === 'history'
    ? createBrowserRouter(routes, ROUTER_BASENAME ? { basename: ROUTER_BASENAME } : undefined)
    : createHashRouter(routes)
}

const router = createAppRouter()

export function AppRouter() {
  return <RouterProvider router={router} />
}
