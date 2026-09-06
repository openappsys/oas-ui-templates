// src/router/index.ts —— createRouter + 双模式历史 + 全局守卫组装
// 未登录 → /login；路径不存在 → /not-found；无权限 → /forbidden（三态语义对齐 react 版 guard）
// 注：简报骨架中 not-found 重定向写作 /404，但路由表（事实来源）只有 /not-found，此处按路由表修正
// 路由模式：按 localStorage（oas-admin.router-mode）二选一 hash/history（设置中心可切换，
// 切换二次确认后整页刷新，此处模块加载时一次性定型）
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { session } from '../store/session'
import { guard } from './guard'
import { ROUTER_BASENAME, routerMode } from './mode'
import { appRoutes } from './routes'

// hash 模式显式以 base 根作 history base（'/' → '/#'；子路径部署 → '/base/#'），
// 与 mode.ts dstHref 生成的 URL 形态一致（缺省会用当前 pathname，切换模式后可能失配）
const HASH_BASE = `${ROUTER_BASENAME ?? ''}/`

export const router = createRouter({
  history:
    routerMode() === 'history'
      ? createWebHistory(ROUTER_BASENAME)
      : createWebHashHistory(HASH_BASE),
  routes: [
    { path: '/login', component: () => import('../pages/login.vue') },
    {
      path: '/',
      component: () => import('../components/app-shell.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        ...appRoutes
          .filter((r) => r.path !== '/login')
          // meta 展开为匿名对象字面量类型以获得隐式索引签名，兼容 vue-router 的 RouteMeta
          .map((r) => ({
            path: r.path.replace(/^\//, ''),
            component: r.Component,
            meta: { ...r.meta },
          })),
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/not-found' },
  ],
})

// 全局守卫：三态判定顺序 login → not-found → forbidden
router.beforeEach((to) => {
  // /login 本身永远放行：guard 纯函数把「未登录访问 /login」判为 forbidden（hasAccess 对 null
  // 用户一律 false，语义逐字对齐 react 版不可改），未登录走到 /forbidden 又弹回 /login 会死循环
  // （react 版无此问题——未登录分支路由树只挂 /login，不经 Guarded）
  if (to.path === '/login') return true
  const result = guard(to.path, session.user)
  if (!result.ok && result.reason === 'login') return '/login'
  if (!result.ok && result.reason === 'not-found') return '/not-found'
  if (!result.ok && result.reason === 'forbidden') return '/forbidden'
  return true
})
