# admin-pro/vue 模版 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `templates/admin-pro/vue` 模版——与 admin-pro/react 功能对齐（机制全对齐 vanilla-html + 同样 11 个页面），Vite + Vue 3 纯 CSR。

**Architecture:** 纯 TS 层（api/data/store/i18n/tabs/settings-init 等）从 **已审定的 `templates/admin-pro/react/src/` 直接复制**（该层与 vanilla 逐字一致、已零漂移验收）；Vue 特有层（isCustomElement 配置、GlobalComponents 类型声明、useT/useTabs 组合式函数、vue-router 路由 + 守卫、`.vue` 页面组件）新写。CSS 从 vanilla 原样复制。

**Tech Stack:** Vite 8 + Vue 3.5 + TypeScript 7 + vue-router 4（hash）+ vue-tsc + vitest 5（happy-dom）+ @vue/test-utils + playwright

**Spec:** `docs/superpowers/specs/2026-09-05-framework-templates-design.md`
**姊妹计划（路由表/页面行为规范的唯一事实来源表述与之一致）：** `docs/superpowers/plans/2026-09-05-admin-pro-react.md`

## Global Constraints

- 新增文件全部在 `templates/admin-pro/vue/` 下；**不动** `vanilla-html` / `cdn` / `cdn-mpa` / `react` / `site/` 任何文件
- `@oas-ui/*` 依赖版本 `^2.4.0`；vitest `^5.0.0`
- vite `base: './'`；hash 路由；dev 端口 **5192**、e2e 端口 **5193**
- 不引第三方状态库；会话/设置用 Vue 响应式包 vanilla 移植的模块级单例（`reactive`/`computed`/`watch`）
- **不建 oas-* wrapper 组件层**；Vue 3 原生支持 `@oas-submit` 等 kebab 事件绑定（playground 实测），**不需要**事件桥接层；复杂数据统一走 JSON attribute（`:columns="JSON.stringify(...)"` 或计算属性）
- 页签不缓存页面内部状态（不用 keep-alive 缓存组件实例）
- 代码注释用中文；commit message 用中文 conventional commits（`feat(admin-vue): ...`）
- localStorage 键名与 vanilla/react 完全一致（`oas-admin.*`）
- 两端功能对齐：路由表 path/meta、页面 DOM 结构、类名、文案 key 与 react 版一致（便于对照定位框架问题 vs 组件问题）
- 每个 Task 结束独立提交；提交前 `pnpm --filter admin-pro-vue test` 全绿、`pnpm --filter admin-pro-vue build` 通过

## 移植总原则

1. **纯 TS 层从 `templates/admin-pro/react/src/` 复制**（不是从 vanilla——react 版已是验收过的定稿）
2. **行为规范事实来源**：vanilla 对应源文件 + react 版对应组件（两者已对齐）
3. CSS 从 vanilla 原样复制（`styles/app.css` + 用到的 `styles/pages/*.css`）
4. Vue 页面组件骨架统一模式：

```vue
<!-- src/pages/forbidden.vue —— 页面组件范例 -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useT } from '../composables/use-t'

const { t } = useT()
const router = useRouter()
</script>

<template>
  <div class="page page-result">
    <oas-icon name="forbidden" />
    <h1>{{ t('result.403.title') }}</h1>
    <p>{{ t('result.403.desc') }}</p>
    <oas-button type="primary" @click="router.push('/')">{{ t('result.backHome') }}</oas-button>
  </div>
</template>
```

---

### Task 1: 工程脚手架 + 纯 TS 层复制（合并任务）

**Files:**
- Create: `templates/admin-pro/vue/package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`、`playwright.config.ts`、`src/main.ts`、`src/App.vue`（占位）、`scripts/size.mjs`（从 vanilla 复制）
- Create（从 **react 模版**原样复制）: `src/api/`、`src/data/`、`src/store/`、`src/i18n/` 全部文件含测试；`src/settings-init.ts`、`src/layout-config.ts`、`src/error.ts`、`src/analytics.ts`、`src/env.d.ts`
- Create: `src/styles/app.css`（从 vanilla 复制）

**Interfaces:**
- Produces: 与 react 模版 Task 2 相同的纯 TS 接口（`http.request`、`session`、`t/setLocale/onLocaleChange`、`applySettings`、`navConfig` 等，签名以复制源为准）

- [ ] **Step 1: package.json**

```json
{
  "name": "admin-pro-vue",
  "private": true,
  "license": "MIT OR Apache-2.0",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "size": "node scripts/size.mjs"
  },
  "dependencies": {
    "@oas-ui/i18n": "^2.4.0",
    "@oas-ui/icons": "^2.4.0",
    "@oas-ui/theme": "^2.4.0",
    "@oas-ui/ui": "^2.4.0",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.62.1",
    "@vitejs/plugin-vue": "^6.0.0",
    "@vue/test-utils": "^2.4.6",
    "happy-dom": "^20.11.2",
    "typescript": "^7.0.2",
    "vite": "^8.2.1",
    "vitest": "^5.0.0",
    "vue-tsc": "^3.0.0"
  }
}
```

- [ ] **Step 2: vite.config.ts / tsconfig.json / playwright.config.ts / index.html**

`vite.config.ts`（**isCustomElement 是 Vue 版关键配置**）：

```ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // oas-* 是 Web Components，不走 Vue 组件解析
          isCustomElement: (tag) => tag.startsWith('oas-'),
        },
      },
    }),
  ],
  base: './',
  server: { port: 5192, strictPort: true },
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts'] },
})
```

`tsconfig.json`：vanilla 底版逐字保留，无 jsx 项。`playwright.config.ts`：vanilla 底版，端口 5174→5193 三处。`index.html`：vanilla 底版（FOUC 脚本逐字保留），`<div id="app">`，入口 `/src/main.ts`。

- [ ] **Step 3: main.ts + 占位 App.vue**

```ts
// src/main.ts —— 初始化顺序与 react 版 main.tsx 对齐：
// 副作用注册 → i18n → 假后端 → 设置重放 → 挂载
import { createApp } from 'vue'
import '@oas-ui/theme'
import '@oas-ui/ui'
import '@oas-ui/icons'
import './styles/app.css'
import { initI18n } from './i18n'
import { enableFakeFetch } from './api/http'
import { applySettings } from './settings-init'
import App from './App.vue'

initI18n()
enableFakeFetch()
applySettings()

createApp(App).mount('#app')
```

占位 `App.vue`：`<template><oas-button type="primary">ok</oas-button></template>`。

- [ ] **Step 4: 复制纯 TS 层**

```bash
cd templates/admin-pro
cp -r react/src/api react/src/data react/src/store react/src/i18n vue/src/
cp react/src/{settings-init.ts,layout-config.ts,error.ts,analytics.ts,env.d.ts} vue/src/
cp vanilla-html/src/styles/app.css vue/src/styles/app.css   # 注意先建 vue/src/styles/ 目录
```

复制后逐目录 `diff -r react/src/api vue/src/api` 等确认零漂移。

- [ ] **Step 5: 验证 + Commit**

```bash
pnpm install
pnpm --filter admin-pro-vue test      # 110/110（与 react Task 2 相同测试集）
pnpm --filter admin-pro-vue build     # vue-tsc + vite build
pnpm --filter admin-pro-vue exec vite --port 5192  # dev 可访问，oas-button 渲染
git add templates/admin-pro/vue pnpm-lock.yaml
git commit -m "feat(admin-vue): 工程脚手架 + 纯 TS 层从 react 模版复制"
```

---

### Task 2: Vue 集成封装层（GlobalComponents 类型 / useT / appMessage）

**Files:**
- Create: `src/oas-components.d.ts`（`declare module 'vue' { interface GlobalComponents { ... } }`，覆盖用到的 oas-* 标签）
- Create: `src/composables/use-t.ts` + `use-t.test.ts`
- Create: `src/lib/app-message.ts`

**Interfaces:**
- Consumes: Task 1 的 i18n 接口
- Produces:
  - `useT(): { t: typeof t; locale: Ref<AppLocale>; setLocale: (l: AppLocale) => void }`——`locale` 是 `ref`，由 `onLocaleChange` 驱动更新
  - `appMessage`：`export { message as appMessage } from '@oas-ui/ui'`（+ 中文注释：window.OASMessage 不存在）

- [ ] **Step 1: use-t.ts + 测试**

```ts
// src/composables/use-t.ts
import { ref, onUnmounted } from 'vue'
import { currentLocale, onLocaleChange, setLocale, t, type AppLocale } from '../i18n'

// 模块级共享 locale ref，组件库 i18n 变化时同步（多个 useT 调用共享同一响应式源）
const locale = ref<AppLocale>(currentLocale())
let subscribed = false
function ensureSubscribed() {
  if (subscribed) return
  subscribed = true
  onLocaleChange((name) => { locale.value = name as AppLocale })
}

/** 订阅组件库 i18n 的 locale 变化，返回 t 函数与响应式 locale */
export function useT() {
  ensureSubscribed()
  return { t, locale, setLocale }
}
```

测试（@vue/test-utils + happy-dom）：挂载组件显示 `t('app.fullname')`；`setLocale('en')` 后断言文案变英文；切回 zh-CN。

- [ ] **Step 2: app-message.ts + oas-components.d.ts**

`oas-components.d.ts` 结构：

```ts
// oas-* Web Components 的 Vue 全局组件类型声明
declare module 'vue' {
  interface GlobalComponents {
    'oas-button': any
    'oas-icon': any
    // … 覆盖本模版用到的全部 oas-* 标签（清单与 react 版 elements.d.ts 同步维护）
  }
}
export {}
```

用 `any` 起步（vue-tsc 对 custom element props 类型化收益低、成本高）；如 vue-tsc 对模板 props 报错过多，可改用带 `Record<string, unknown>` 的宽松类型。本任务先声明 12 个基础标签（同 react Task 3 清单）。

- [ ] **Step 3: 验证 + Commit**

```bash
pnpm --filter admin-pro-vue test && pnpm --filter admin-pro-vue build
git add templates/admin-pro/vue && git commit -m "feat(admin-vue): 集成封装层（useT/类型声明/appMessage）"
```

---

### Task 3: 路由层（routes 表 + guard + tabs + vue-router 组装）

**Files:**
- Create: `src/router/routes.ts`（AppRoute 类型 + 11 页路由表，meta 与 react 版 `routes.tsx` 逐字对齐）
- Create: `src/router/tabs.ts` + `tabs.test.ts`（从 react 模版复制，零改动预期）
- Create: `src/router/guard.ts` + `guard.test.ts`（逻辑与 react 版逐字对齐，从 react 复制适配 import）
- Create: `src/composables/use-tabs.ts`（`reactive` 驱动 tabs 纯函数状态机）
- Create: `src/router/index.ts`（`createRouter` + `createWebHashHistory` + `beforeEach` 守卫）

**Interfaces:**
- Produces（与 react 版同名同语义）：`AppRouteMeta`、`AppRoute`、`appRoutes`、`guard(path, user)`、`useTabs()`、`tabs.ts` 全部导出

- [ ] **Step 1: 复制 tabs.ts / guard.ts 及测试**

```bash
cp react/src/router/tabs.ts react/src/router/tabs.test.ts vue/src/router/
cp react/src/router/guard.ts vue/src/router/   # import 路径适配：react 的 routes.tsx → 本地 routes.ts
```

guard.test.ts 参照 react 版重写或复制适配（如 react 版 guard.test.ts 存在则直接复制）。

- [ ] **Step 2: routes.ts + use-tabs.ts + index.ts**

路由表 11 条与 react 版逐字对齐（同 path/titleKey/icon/iconColor/roles/hidden/group/parent）；vue-router 组装：

```ts
// src/router/index.ts
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
          .map((r) => ({ path: r.path.replace(/^\//, ''), component: r.Component, meta: r.meta })),
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/404' },
  ],
})

// 全局守卫：未登录 → /login；无权限 → /forbidden（语义对齐 react 版 guard 三态）
router.beforeEach((to) => {
  const result = guard(to.path, session.user)
  if (!result.ok && result.reason === 'login') return '/login'
  if (!result.ok && result.reason === 'forbidden') return '/forbidden'
  if (!result.ok && result.reason === 'not-found') return '/404'
  return true
})
```

注意 `appRoutes` 的 `Component` 在 vue 版为 `() => import('../pages/xxx.vue')` 懒加载函数。**本任务为全部 11 个页面建占位 `.vue` 文件**（模板只含 `<div class="page" />`），否则懒加载指向不存在文件导致 build 失败；后续任务逐个替换（settings→Task 4、login/dashboard→Task 5、products/product-edit→Task 6、其余→Task 7）。AppShell 本任务建占位（只含 `<router-view />`）。

- [ ] **Step 3: 验证 + Commit**

```bash
pnpm --filter admin-pro-vue test && pnpm --filter admin-pro-vue build
git add templates/admin-pro/vue && git commit -m "feat(admin-vue): 路由层（routes/guard/tabs/vue-router hash）"
```

---

### Task 4: AppShell 布局壳 + 设置中心页

**Files:**
- Create: `src/components/app-shell.vue`（含 `<router-view/>`、页签栏、面包屑、footer）
- Create: `src/components/header-bar.vue`、`src/components/nav-menu.vue`、`src/components/tabs-bar.vue`、`src/components/notifications-drawer.vue`、`src/components/command-palette.vue`
- Create: `src/pages/settings.vue`（真实实现，替换占位）+ `src/styles/pages/settings.css`（从 vanilla 复制）
- Modify: `src/router/index.ts`（接真实 AppShell——若懒加载指向占位文件路径相同则无需改）

**Interfaces / 行为规范：** 与 react 计划 Task 5、Task 6 的行为规范**逐条相同**（事实来源同为 vanilla `app-shell.ts` / `settings.ts`）：slot 结构与类名逐字对齐、形态×位置矩阵 8 种合法组合、三形态高亮差异、`'oas:navconfig-change'` 实时切换（Vue 里用响应式状态订阅，模板重渲染）、主题切换写 `documentElement.dataset.theme` + `'themechange'`、页签语义与 tabs.spec 一致、Command 面板 Ctrl+K / `/`、设置中心四 Tab 的持久化键与即时生效方式逐项对齐。自定义事件用模板 `@oas-change` / `@oas-close` 绑定（Vue 原生支持）；命令式 API 用 `appMessage`。

- [ ] **Step 1: 五个壳层子组件 + app-shell.vue**（菜单 items 从 `appRoutes` + meta 推导，分支逻辑对齐 vanilla `menuHTML()`）
- [ ] **Step 2: settings.vue**（四 Tab；控件 `oas-change` 用 `@oas-change` 绑定；值用 `ref` 初始化自 `readXxx()`）
- [ ] **Step 3: 补充 oas-components.d.ts**（壳层 + 设置中心用到的全部新标签）
- [ ] **Step 4: 验证 + Commit**

```bash
pnpm --filter admin-pro-vue test && pnpm --filter admin-pro-vue build
# 手动 dev：登录 → 壳层渲染；设置中心改主题色即时生效；布局矩阵切换壳实时重建
git add templates/admin-pro/vue && git commit -m "feat(admin-vue): AppShell 布局壳 + 设置中心页"
```

---

### Task 5: 页面第一批——login + dashboard

**Files:**
- Create: `src/pages/login.vue`、`src/pages/dashboard.vue`（替换占位）

**行为规范：** 与 react 计划 Task 7 相同（vanilla `login.ts` 双版式、`dashboard.ts` 7/14/30 天联动逐块对齐）。Vue 差异点：`oas-submit` 用 `@oas-submit="onSubmit"` 直接绑定（playground 实测 Vue 原生支持）；跨 shadow 提交用 `formRef.value?.shadowRoot?.querySelector('form')?.requestSubmit()`（模板 `ref="formRef"` + `useTemplateRef` 或普通 ref）；异步数据 `onMounted` 拉取进 `ref`。

- [ ] **Step 1: login.vue**（登录即 `session.login()` 本地直登；成功后 `router.push('/dashboard')`）
- [ ] **Step 2: dashboard.vue**
- [ ] **Step 3: 补充 oas-components.d.ts**
- [ ] **Step 4: 验证 + Commit**

```bash
pnpm --filter admin-pro-vue test && pnpm --filter admin-pro-vue build
git add templates/admin-pro/vue && git commit -m "feat(admin-vue): login + dashboard 页"
```

---

### Task 6: 页面第二批——products + product-edit

**Files:**
- Create: `src/pages/products.vue`、`src/pages/product-edit.vue`、`src/pages/product-columns.ts`（从 react 复制 + 测试）、`src/styles/pages/products.css`（从 vanilla 复制）

**行为规范：** 与 react 计划 Task 8 相同（双视图、三表单模式、批量操作、列设置持久化、分页）。Vue 差异点：表格 `columns`/`data` 用 `:columns="columnsJson"` 计算属性（`computed(() => JSON.stringify(cols))`）；`oas-sort-change` 等事件 `@oas-sort-change` 直绑。建议拆 `products-table.vue` / `product-form.vue` 子组件，单文件不超 400 行。

- [ ] **Step 1: product-columns.ts 复制 + 测试绿**
- [ ] **Step 2: products.vue（含子组件）**
- [ ] **Step 3: product-edit.vue**
- [ ] **Step 4: 补充 oas-components.d.ts**
- [ ] **Step 5: 验证 + Commit**

```bash
pnpm --filter admin-pro-vue test && pnpm --filter admin-pro-vue build
git add templates/admin-pro/vue && git commit -m "feat(admin-vue): products CRUD + product-edit 页"
```

---

### Task 7: 页面第三批——advanced-form / data-board / users / profile / forbidden / not-found

**Files:**
- Create: 六个 `.vue` 页面（替换占位）+ `src/styles/pages/{advanced-form,data-board}.css`（从 vanilla 复制）

**行为规范：** 与 react 计划 Task 9 相同；骨架模式见本计划「移植总原则」的 forbidden.vue 范例。users 页建议拆子组件。

- [ ] **Step 1: forbidden + not-found**（先打样）
- [ ] **Step 2: advanced-form + data-board**
- [ ] **Step 3: users + profile**
- [ ] **Step 4: 补充 oas-components.d.ts**
- [ ] **Step 5: 验证 + Commit**

```bash
pnpm --filter admin-pro-vue test && pnpm --filter admin-pro-vue build
git add templates/admin-pro/vue && git commit -m "feat(admin-vue): advanced-form/data-board/users/profile/错误页"
```

---

### Task 8: e2e 移植 + 整站构建验证

**Files:**
- Create: `e2e/smoke.spec.ts`、`e2e/tabs.spec.ts`、`e2e/settings.spec.ts`、`e2e/products.spec.ts`

**移植规则：** 与 react 计划 Task 10 相同——断言语义逐条对齐 vanilla spec；类名/DOM 结构已在 Task 4-7 对齐；若 react 版 e2e 已完成，可直接对照 react 版 spec 复制（两者断言应几乎逐字一致，这是两端对齐的验收手段）。

- [ ] **Step 1: smoke.spec.ts**
- [ ] **Step 2: tabs.spec.ts**
- [ ] **Step 3: settings.spec.ts + products.spec.ts**
- [ ] **Step 4: 运行 e2e**

```bash
pnpm --filter admin-pro-vue test:e2e
```

Expected: 全绿（ flaky 处理规则同 react 计划：`expect.poll`/`waitFor`，禁止堆 `waitForTimeout`）

- [ ] **Step 5: 聚合构建 + size**

```bash
pnpm site
pnpm --filter admin-pro-vue size
```

- [ ] **Step 6: Commit**

```bash
git add templates/admin-pro/vue
git commit -m "test(admin-vue): e2e 四 spec（smoke/tabs/settings/products）"
```

---

## 收尾（控制器执行，不在 subagent 任务内）

- 门户首页两张卡片（react + vue）+ README 表格统一加
- 两端对照检查：路由表、页面 DOM 结构、文案 key 一致性抽查
