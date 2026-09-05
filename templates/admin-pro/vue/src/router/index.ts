// src/router/index.ts —— createRouter + hash 历史 + 全局守卫组装
// 未登录 → /login；路径不存在 → /not-found；无权限 → /forbidden（三态语义对齐 react 版 guard）
// 注：简报骨架中 not-found 重定向写作 /404，但路由表（事实来源）只有 /not-found，此处按路由表修正
import { createRouter, createWebHashHistory } from 'vue-router'
import { session } from '../store/session'
import { guard } from './guard'
import { appRoutes } from './routes'

export const router = createRouter({
  history: createWebHashHistory(),
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
          .map((r) => ({ path: r.path.replace(/^\//, ''), component: r.Component, meta: { ...r.meta } })),
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/not-found' },
  ],
})

// 全局守卫：三态判定顺序 login → not-found → forbidden
router.beforeEach((to) => {
  const result = guard(to.path, session.user)
  if (!result.ok && result.reason === 'login') return '/login'
  if (!result.ok && result.reason === 'not-found') return '/not-found'
  if (!result.ok && result.reason === 'forbidden') return '/forbidden'
  return true
})
