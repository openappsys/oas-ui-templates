# admin-pro/react 模版 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `templates/admin-pro/react` 模版——机制全对齐 vanilla-html（请求层/权限守卫/i18n/多页签/设置中心/可配置导航）+ 11 个代表页面，Vite + React 19 纯 CSR。

**Architecture:** 纯 TS 层（api/data/store/i18n/tabs/settings-init）从 vanilla **原样复制**（含测试）；React 特有层（elements.d.ts 类型声明、useOasEvent/useT hooks、react-router 路由 + 守卫、函数组件页面）新写；页面契约从 vanilla 的 `render(el): dispose` 映射为「函数组件 + useEffect 清理」。样式 CSS 原样复制。

**Tech Stack:** Vite 8 + React 19 + TypeScript 7 + react-router 7（hash）+ vitest 4（happy-dom）+ @testing-library/react + playwright

**Spec:** `docs/superpowers/specs/2026-09-05-framework-templates-design.md`

## Global Constraints

- 新增文件全部在 `templates/admin-pro/react/` 下；**不动** `vanilla-html` / `cdn` / `cdn-mpa` / `site/` 任何文件（门户卡片与 README 由控制器收口时统一加，不在本计划）
- `@oas-ui/*` 依赖版本 `^2.4.0`（npm 发布版，非 workspace 链接）
- vite `base: './'`；hash 路由；dev 端口 **5182**、e2e 端口 **5183**（避开 vanilla 的 5173/5174 和 playground 的 5180/5181）
- 不引第三方状态库；会话/设置用 `useSyncExternalStore` 包 vanilla 移植过来的模块级单例
- **不建 oas-* wrapper 组件层**；事件桥接统一走 `useOasEvent`，复杂数据统一走 JSON attribute
- React 19 对 custom element 的 `on*` prop 不会绑定 kebab 事件（实测坑），代码里**禁止**写 `onOasXxx={...}` 期待其生效；类型声明里保留它们仅为 TS 不报错
- 页签不缓存页面内部状态（无 keep-alive）
- 代码注释用中文；commit message 用中文 conventional commits（`feat(admin-react): ...` / `test(admin-react): ...`）
- localStorage 键名与 vanilla 完全一致（`oas-admin.*`），保证用户切换模版时偏好延续
- 每个 Task 结束独立提交；提交前 `pnpm --filter admin-pro-react test` 全绿、`pnpm --filter admin-pro-react build` 通过

## 移植总原则（每个移植任务都适用）

1. **纯 TS 文件原样复制**：只改相对 import 路径；内容、注释、测试逐字保留
2. **vanilla 源文件即行为规范**：React 组件的 DOM 结构、oas-* 属性、事件、文案 key 以对应 vanilla 文件为准；计划只给 React 特有的骨架代码与映射规则
3. CSS 原样复制（全局 `styles/app.css` + 用到的 `styles/pages/*.css`）
4. React 页面组件骨架统一模式：

```tsx
// src/pages/forbidden.tsx —— vanilla pages/forbidden.ts 的 React 映射范例
import { useT } from '../hooks/use-t'
import { useNavigate } from 'react-router'

export default function ForbiddenPage() {
  const { t } = useT()
  const navigate = useNavigate()
  return (
    <div className="page page-result">
      <oas-icon name="forbidden" />
      <h1>{t('result.403.title')}</h1>
      <p>{t('result.403.desc')}</p>
      <oas-button type="primary" onClick={() => navigate('/')}>{t('result.backHome')}</oas-button>
    </div>
  )
}
```

映射规则：**`onClick` 等原生事件可直接绑；`oas-*` 自定义事件一律 `useOasEvent`；对象/数组数据一律 `JSON.stringify` 后传 attribute 字符串**（playground 实测模式）。

---

### Task 1: 工程脚手架（可 dev、可 build、可测试的空壳）

**Files:**
- Create: `templates/admin-pro/react/package.json`
- Create: `templates/admin-pro/react/vite.config.ts`
- Create: `templates/admin-pro/react/tsconfig.json`
- Create: `templates/admin-pro/react/index.html`
- Create: `templates/admin-pro/react/playwright.config.ts`
- Create: `templates/admin-pro/react/src/main.tsx`
- Create: `templates/admin-pro/react/src/App.tsx`（占位，Task 5 替换为路由 + AppShell）
- Create: `templates/admin-pro/react/scripts/size.mjs`（从 `templates/admin-pro/vanilla-html/scripts/size.mjs` 原样复制）

**Interfaces:**
- Produces: 工程骨架；`src/main.tsx` 的初始化顺序供后续任务依赖（见下）

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "admin-pro-react",
  "private": true,
  "license": "MIT OR Apache-2.0",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
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
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.9.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.62.1",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "happy-dom": "^20.11.2",
    "typescript": "^7.0.2",
    "vite": "^8.2.1",
    "vitest": "^5.0.0"
  }
}
```

- [ ] **Step 2: 写 vite.config.ts / tsconfig.json / playwright.config.ts**

`vite.config.ts`（vitest 配置合一，同 vanilla 模式）：

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5182, strictPort: true },
  test: { environment: 'happy-dom', include: ['src/**/*.test.{ts,tsx}'] },
})
```

`tsconfig.json`：以 `templates/admin-pro/vanilla-html/tsconfig.json` 为底，差异仅两处——`"jsx": "react-jsx"`；`include` 覆盖 `src`、`e2e`、两个配置文件。其余（target/module/moduleResolution/lib/strict/noEmit/isolatedModules/types）逐字保留。

`playwright.config.ts`：以 vanilla 版为底，`webServer` 改 `pnpm exec vite --port 5183 --strictPort`，`use.baseURL` 改 `http://localhost:5183`；`testDir`、`timeout`、`use.locale: 'zh-CN'`、CI retries 逐字保留。

`index.html`：以 vanilla 版为底（含防 FOUC 的 lang 预设内联脚本，逐字保留），`<div id="app">` 改 `<div id="root">`，入口改 `/src/main.tsx`。

- [ ] **Step 3: 写 src/main.tsx 与占位 App.tsx**

```tsx
// src/main.tsx —— 初始化顺序与 vanilla main.ts 对齐：
// 副作用注册 → i18n → 假后端 → 设置重放 → 挂载
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@oas-ui/theme'
import '@oas-ui/ui'
import '@oas-ui/icons'
import './styles/app.css'
import { initI18n } from './i18n'
import { enableFakeFetch } from './api/http'
import { applySettings } from './settings-init'
import App from './App'

initI18n()
enableFakeFetch()
applySettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

注意：`./i18n`、`./api/http`、`./settings-init`、`./styles/app.css` 由 Task 2/5 提供——**本任务先建占位实现**（`i18n/index.ts` 空 `initI18n(){}`、`api/http.ts` 空 `enableFakeFetch(){}`、`settings-init.ts` 空 `applySettings(){}`、`styles/app.css` 空文件），Task 2/5 替换为真实实现。占位 `App.tsx` 渲染 `<oas-button type="primary">ok</oas-button>` 验证组件注册生效。

- [ ] **Step 4: 验证**

```bash
pnpm install                                    # workspace 自动发现新包
pnpm --filter admin-pro-react build             # tsc + vite build 通过
pnpm --filter admin-pro-react exec vite --port 5182 & sleep 3 && curl -s http://localhost:5182 | grep -q 'src/main.tsx' && kill %1
```

Expected: install 成功；build exit 0；dev 页面可访问

- [ ] **Step 5: Commit**

```bash
git add templates/admin-pro/react
git commit -m "feat(admin-react): 工程脚手架（vite8 + react19 + vitest + playwright）"
```

---

### Task 2: 纯 TS 层移植（api / data / store / i18n / settings-init / 基础设施）★ Vue 复制检查点

**Files:**
- Create（全部从 vanilla 同名文件**原样复制**，仅改相对 import 路径）:
  - `src/api/request.ts` `src/api/http.ts` `src/api/auth.ts` + `request.test.ts`
  - `src/data/store.ts` `products.ts` `categories.ts` `users.ts` `orders.ts` `dashboard.ts` `board.ts` `adv-form.ts` `notifications.ts` `logs.ts` `system.ts` + 全部 `*.test.ts`
  - `src/store/session.ts` + `session.test.ts`
  - `src/i18n/index.ts` `app-zh.ts` `app-en.ts` + `index.test.ts`
  - `src/settings-init.ts`、`src/layout-config.ts`、`src/error.ts`、`src/analytics.ts` + 各自 `*.test.ts`
- Modify: `src/main.tsx`（删掉占位 import，接真实模块）

**Interfaces:**
- Produces（后续任务依赖，签名以 vanilla 源码为准）:
  - `http.request<T>(opts)`、`enableFakeFetch()`；`login/fetchProfile/fetchOrders`
  - data 各模块函数集合（如 `listProducts(): Promise<ProductRow[]>` 等）
  - `session.user / session.login(name, role) / session.logout() / session.subscribe(fn)`、`hasAccess(user, roles?)`
  - `t(key, params?)`、`setLocale(name)`、`currentLocale()`、`onLocaleChange(cb)`、`AppLocale = 'zh-CN' | 'en'`、`detectLocale()`、`initI18n()`
  - `applySettings()`、`readFormMode()`、`readDensity()`、`readPageSize()`、`readTabsBar()`、`readRadius()`、`readFontSize()`、`readColor()`、`currentTheme()`、`applyDensity()`、`applyFontSize()`、各 `*_KEY` 常量
  - `navConfig()`、`setMenuStyle()`、`setMenuPosition()`、`canPosition()`、`readMenuStyle()`、`readMenuPosition()`、`readSidebarCollapsed()`、`writeSidebarCollapsed()`、`MenuStyle`、`MenuPosition`、`NavConfig`
  - `reportError(err, source, extra?)`

- [ ] **Step 1: 复制文件**

```bash
cd templates/admin-pro
cp vanilla-html/src/api/*.ts react/src/api/
cp vanilla-html/src/data/*.ts react/src/data/
cp vanilla-html/src/store/*.ts react/src/store/
cp vanilla-html/src/i18n/*.ts react/src/i18n/
cp vanilla-html/src/{settings-init.ts,layout-config.ts,error.ts,analytics.ts,boot.test.ts,error.test.ts} react/src/
```

- [ ] **Step 2: 逐文件检查 import 路径与测试可用性**

vanilla 文件全部相对 import 且无 alias，同构目录下**理论上零改动**；逐个 `rg "^import" react/src/{api,data,store,i18n}` 确认没有指向 vanilla 独有文件（如 router/pages）的引用，有则记录并适配（预期：无）。`boot.test.ts` 若引用 vanilla 的 main.ts 启动序列，改为适配 React 版 main.tsx 的等价断言或删除该测试并在报告中说明理由。

- [ ] **Step 3: main.tsx 接真实模块**

删除占位 `initI18n/enableFakeFetch/applySettings` 空实现，main.tsx 保持 Task 1 Step 3 的代码不变（import 路径已对齐真实文件）。

- [ ] **Step 4: 验证**

```bash
pnpm --filter admin-pro-react test        # vanilla 移植的全部单测
pnpm --filter admin-pro-react build
```

Expected: 全绿；build exit 0

- [ ] **Step 5: Commit + 通知控制器**

```bash
git add templates/admin-pro/react
git commit -m "feat(admin-react): 纯 TS 层从 vanilla 移植（api/data/store/i18n/设置）"
```

**本任务完成后是纯 TS 层定稿检查点**——控制器将启动 Vue 模版并复制 `src/api`、`src/data`、`src/store`、`src/i18n`。

---

### Task 3: React 集成封装层（elements.d.ts / useOasEvent / useT / appMessage）

**Files:**
- Create: `templates/admin-pro/react/src/elements.d.ts`
- Create: `templates/admin-pro/react/src/hooks/use-oas-event.ts` + `use-oas-event.test.tsx`
- Create: `templates/admin-pro/react/src/hooks/use-t.ts` + `use-t.test.tsx`
- Create: `templates/admin-pro/react/src/lib/app-message.ts`

**Interfaces:**
- Consumes: Task 2 的 `onLocaleChange` / `currentLocale` / `setLocale` / `t` / `AppLocale`
- Produces:
  - `useOasEvent<T = unknown>(ref: React.RefObject<HTMLElement | null>, type: string, handler: (detail: T, ev: Event) => void): void`——handler 变化不重复解绑（内部用 ref 持最新 handler）
  - `useT(): { t: typeof t; locale: AppLocale; setLocale: (l: AppLocale) => void }`——locale 变化触发重渲染
  - `appMessage`：`@oas-ui/ui` 的 `message` 的再导出（统一入口 + 注释说明 `window.OASMessage` 不存在）

- [ ] **Step 1: 写 use-oas-event.ts 及测试**

```tsx
// src/hooks/use-oas-event.ts
import { useEffect, useRef } from 'react'

/** 绑定 oas-* 自定义事件（React 19 不会把 onXxx prop 绑到 kebab 事件，必须手动 addEventListener） */
export function useOasEvent<T = unknown>(
  ref: React.RefObject<HTMLElement | null>,
  type: string,
  handler: (detail: T, ev: Event) => void,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const listener = (ev: Event) => {
      handlerRef.current((ev as CustomEvent<T>).detail, ev)
    }
    el.addEventListener(type, listener)
    return () => el.removeEventListener(type, listener)
  }, [ref, type])
}
```

测试（`use-oas-event.test.tsx`，happy-dom + @testing-library/react）：渲染一个带 ref 的 `<div>`，`useOasEvent(ref, 'oas-submit', spy)` 挂载后 `el.dispatchEvent(new CustomEvent('oas-submit', { detail: { values: { a: '1' } } }))`，断言 spy 收到 `detail.values.a === '1'`；卸载后再 dispatch，断言不再触发（cleanup 生效）。

- [ ] **Step 2: 写 use-t.ts 及测试**

```tsx
// src/hooks/use-t.ts
import { useSyncExternalStore } from 'react'
import { currentLocale, onLocaleChange, setLocale, t, type AppLocale } from '../i18n'

/** 订阅组件库 i18n 的 locale 变化，返回 t 函数与当前 locale */
export function useT() {
  const locale = useSyncExternalStore(onLocaleChange, currentLocale)
  return { t, locale, setLocale }
}
```

测试：渲染组件显示 `t('app.fullname')`；`act(() => setLocale('en'))` 后断言文案变英文；切回 `zh-CN` 变中文。

- [ ] **Step 3: 写 app-message.ts 与 elements.d.ts**

```ts
// src/lib/app-message.ts
// 组件库消息 API 唯一入口：window.OASMessage 不存在，必须具名 import
export { message as appMessage } from '@oas-ui/ui'
```

`elements.d.ts`：以 `/var/www/zandy/oas-ui/packages/playground/react/elements.d.ts` 的 `declare namespace React { namespace JSX { interface IntrinsicElements } }` 结构为模板，覆盖本模版用到的全部 `oas-*` 标签（清单见 Task 5-9 各页面；统一规则：标量 prop 按 HTML 语义声明 `string | boolean | number`，数据型 prop（`columns`/`data`/`options`/`rules`/`items`）声明 `string`（JSON），kebab 属性加引号键名如 `'row-key'?: string`，自定义事件声明 `onOasXxx?: (e: Event) => void` **仅供类型通过**）。本任务先声明以下 12 个基础标签（后续任务用到新标签时补充，每个任务自查）：`oas-button` `oas-icon` `oas-input` `oas-select` `oas-form` `oas-form-item` `oas-card` `oas-tag` `oas-space` `oas-modal` `oas-drawer` `oas-switch`。

- [ ] **Step 4: 验证**

```bash
pnpm --filter admin-pro-react test
pnpm --filter admin-pro-react build    # tsc 验证 elements.d.ts 生效
```

Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add templates/admin-pro/react
git commit -m "feat(admin-react): React 集成封装层（useOasEvent/useT/类型声明）"
```

---

### Task 4: 路由层（routes 表 + guard + tabs 状态机 + HashRouter 组装）

**Files:**
- Create: `src/router/routes.tsx`（路由表 + AppRoute 类型）
- Create: `src/router/tabs.ts`（从 `vanilla-html/src/router/tabs.ts` 复制适配类型）+ `tabs.test.ts`（从 vanilla 复制适配）
- Create: `src/router/guard.ts` + `guard.test.ts`
- Create: `src/router/use-tabs.ts`（tabs 状态机的 React binding）
- Create: `templates/admin-pro/react/src/router/index.tsx`（HashRouter + 守卫 + 布局路由组装，Task 5 的 AppShell 作为布局路由组件接入）

**Interfaces:**
- Consumes: Task 2 的 `session` / `hasAccess`；Task 3 的 `useOasEvent`（Task 5 页签栏用）
- Produces:
  - `interface AppRouteMeta { titleKey: string; icon: string; iconColor?: string; roles?: string[]; hidden?: boolean; group?: 'nav.output' | 'nav.business' | 'nav.system' | 'nav.demo'; parent?: string }`
  - `interface AppRoute { path: string; meta: AppRouteMeta; Component: React.LazyExoticComponent<React.ComponentType> }`
  - `const appRoutes: AppRoute[]`（11 条，path/meta 与 vanilla `routes.ts` 中对应页面逐字对齐；`/` 重定向到 `/dashboard`）
  - `guard(path: string, user: User | null): { ok: true; path: string } | { ok: false; reason: 'login' | 'forbidden' | 'not-found' }`
  - `useTabs(currentPath: string): { view: TabsView; closeTab(k): void; closeKeys(ks): void; closeAll(): void; navigateTo: string | null }`——内部 `useReducer` 驱动 vanilla 移植的 `visit/closeTab/closeKeys/closeAll` 纯函数
  - `tabs.ts` 移植版导出与 vanilla 同名：`TabsView`、`TabsCloseResult`、`tabKeyOf`、`visit`、`closeTab`、`closeKeys`、`closeAll`、`HOME_PATH`

- [ ] **Step 1: 移植 tabs.ts + tabs.test.ts**

复制 `vanilla-html/src/router/tabs.ts` → `react/src/router/tabs.ts`，适配点仅类型 import：vanilla 的 `Route` 换为本地 `AppRoute`（结构同名兼容：`path` + `meta.hidden` + `meta.parent`）。`tabs.test.ts` 同步复制适配。运行测试确认全绿（先写 routes.tsx 骨架让类型可编译——先做 Step 2 的 routes.tsx 再跑测试）。

- [ ] **Step 2: 写 routes.tsx**

路由表 11 条（Component 用 `React.lazy(() => import('../pages/xxx'))`），path/titleKey/icon/iconColor/roles/hidden/group/parent 逐字对齐 vanilla `routes.ts` 中这些页面的条目：`/login`（hidden）、`/dashboard`（group nav.output）、`/products` + `/products/edit`（roles ['admin']，edit hidden+parent /products）、`/advanced-form`、`/data-board`、`/users`（roles ['admin','viewer']，group nav.system）、`/profile`（hidden）、`/settings`（group nav.system）、`/forbidden`、`/404`（均 hidden）。首页 = `/dashboard`。

**本任务为全部 11 个页面建占位组件文件**（`export default function XxxPage() { return <div className="page" /> }`），否则 lazy import 指向不存在文件会导致 tsc/build 失败；后续任务逐个替换为真实实现（settings→Task 6、login/dashboard→Task 7、products/product-edit→Task 8、其余→Task 9）。

- [ ] **Step 3: 写 guard.ts + 测试**

```ts
// src/router/guard.ts —— 守卫三态，语义对齐 vanilla router.ts 的 guard()
import { hasAccess, type User } from '../store/session'
import { appRoutes } from './routes'

export type GuardResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'login' | 'forbidden' | 'not-found' }

export function guard(path: string, user: User | null): GuardResult {
  if (path !== '/login' && !user) return { ok: false, reason: 'login' }
  const route = appRoutes.find((r) => r.path === path)
  if (!route) return { ok: false, reason: 'not-found' }
  if (!hasAccess(user, route.meta.roles)) return { ok: false, reason: 'forbidden' }
  return { ok: true, path }
}
```

测试：未登录访问 `/dashboard` → login；已登录访问不存在路径 → not-found；viewer 访问 `/products`（roles ['admin']）→ forbidden；admin 访问 `/products` → ok。

- [ ] **Step 4: 写 use-tabs.ts 与 index.tsx 组装**

`use-tabs.ts`：`useReducer` 持有 `TabsView`；`useEffect` 监听 `currentPath` 变化调 `visit`；`navigateTo` 暴露给调用方执行 `navigate()`。`index.tsx`：

```tsx
// src/router/index.tsx
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from '../components/app-shell'
import { guard } from './guard'
import { appRoutes } from './routes'
import { session } from '../store/session'
import { useSyncExternalStore } from 'react'

function Guarded({ route }: { route: (typeof appRoutes)[number] }) {
  const user = useSyncExternalStore(session.subscribe, () => session.user)
  const result = guard(route.path, user)
  if (!result.ok && result.reason === 'forbidden') return <Navigate to="/forbidden" replace />
  if (!result.ok && result.reason === 'not-found') return <Navigate to="/404" replace />
  return <route.Component />
}

export function AppRouter() {
  const user = useSyncExternalStore(session.subscribe, () => session.user)
  if (!user) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    )
  }
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {appRoutes.filter((r) => r.path !== '/login').map((r) => (
            <Route key={r.path} path={r.path} element={<Guarded route={r} />} />
          ))}
        </Route>
      </Routes>
    </HashRouter>
  )
}
```

（`LoginPage` 直接 `import`，不懒加载——未登录首屏要快；`AppShell` 由 Task 5 提供，`LoginPage` 由 Task 7 提供，本任务各建占位组件（`AppShell` 仅渲染 `<Outlet/>`、`LoginPage` 仅渲染占位文案），保证本任务 build 通过；`forbidden`/`not-found` 页面组件在 Task 9 才实现，本任务路由表中这两条的 Component 也先建占位。）

- [ ] **Step 5: 验证 + Commit**

```bash
pnpm --filter admin-pro-react test && pnpm --filter admin-pro-react build
git add templates/admin-pro/react && git commit -m "feat(admin-react): 路由层（routes/guard/tabs 状态机/HashRouter）"
```

---

### Task 5: AppShell 布局壳 + 可配置导航 + 主题/语言/通知/用户区

**Files:**
- Create: `src/components/app-shell.tsx`（布局路由组件，含 `<Outlet/>`、页签栏、面包屑、footer）
- Create: `src/components/header-bar.tsx`（☰/logo/搜索/全屏/主题点/语言 dropdown/通知 badge/用户 dropdown）
- Create: `src/components/nav-menu.tsx`（sidebar/menubar/navigation 三形态 × 位置分派）
- Create: `src/components/tabs-bar.tsx`（oas-tabs 页签条 + 右键菜单）
- Create: `src/components/notifications-drawer.tsx`、`src/components/command-palette.tsx`
- Create: `src/styles/app.css`（从 vanilla **原样复制** 2010 行全局样式）
- Modify: `src/router/index.tsx`（接真实 AppShell）

**Interfaces:**
- Consumes: Task 2 `layout-config`/`session`/`notifications`/i18n；Task 3 `useOasEvent`/`useT`/`appMessage`；Task 4 `useTabs`/`appRoutes`
- Produces: `export function AppShell(): JSX.Element`（布局路由组件，内嵌 `<Outlet/>`）

**行为规范（唯一事实来源 = `vanilla-html/src/components/app-shell.ts`）：**

- slot 结构、类名、`oas-layout` 属性（`viewport`、`side`、`data-menu-style`）逐字对齐 vanilla 模板字符串产出的 DOM
- 形态×位置矩阵：`canPosition(style, position)` 控制 8 种合法组合；高亮机制 sidebar 用 `active`、menubar 用 `value`、navigation 用 items 内 `active` 字段
- 实时切换：监听 window `'oas:navconfig-change'` → 重渲染（React 里变为 state 订阅，不手动重建 DOM）
- 主题切换写 `document.documentElement.dataset.theme` + 派 `'themechange'`；语言 `setLocale`；通知抽屉对接 `data/notifications`；登出 `session.logout()`；`no-chrome` 由 Task 4 的未登录分支天然接管（无需此类）
- 页签栏：`useTabs` + `oas-tabs`；事件 `oas-change`/`oas-close` 走 `useOasEvent`；`[data-ptab-close]` 自定义关闭钮、右键「关闭其他/关闭全部」语义与 tabs.spec 断言一致
- Command 面板：Ctrl+K / `/` 唤起，items = 页面 + 操作（theme/refresh/logout/locale）+ 主题组

- [ ] **Step 1: 复制 app.css 并对齐类名**

`cp vanilla-html/src/styles/app.css react/src/styles/app.css`。React 组件的 className 必须与其中选择器完全对应（`.app`、`.nav-sider`、`.top-nav-bar`、`.ptab`、`page-enter` 等）。

- [ ] **Step 2: 实现五个子组件 + AppShell 组装**

按上方行为规范逐块实现；每个 oas-* 自定义事件用 `useOasEvent`。菜单 items 数据从 `appRoutes` + `meta.group`/`meta.icon` 推导（sidebar 扁平带 group、menubar/navigation 嵌套 children，对齐 vanilla `menuHTML()` 的分支逻辑）。页面入场动画：路由切换时给 `<main>` 重挂 `page-enter` class（key=location.pathname 即可自然重挂载）。

- [ ] **Step 3: 补充 elements.d.ts**

新增壳层标签声明：`oas-layout` `oas-sider` `oas-sidebar` `oas-menubar` `oas-navigation-menu` `oas-tabs` `oas-tab-panel` `oas-breadcrumb` `oas-command` `oas-badge` `oas-dropdown` `oas-avatar` `oas-list` `oas-list-item`。

- [ ] **Step 4: 验证**

```bash
pnpm --filter admin-pro-react test && pnpm --filter admin-pro-react build
pnpm --filter admin-pro-react exec vite --port 5182
# 手动：登录后壳层渲染正常，三种菜单形态 × 位置切换正常（settings 页 Task 6 才做，本任务可临时在 console 派 oas:navconfig-change 验证）
```

- [ ] **Step 5: Commit**

```bash
git add templates/admin-pro/react
git commit -m "feat(admin-react): AppShell 布局壳 + 可配置导航 + 页签栏"
```

---

### Task 6: 设置中心页（四 Tab）

**Files:**
- Create: `src/pages/settings.tsx`
- Create: `src/styles/pages/settings.css`（从 vanilla 复制）

**Interfaces:**
- Consumes: Task 2 `settings-init` 全部读取器/应用器 + `layout-config` + i18n；Task 3 `useOasEvent`/`useT`/`appMessage`
- Produces: 页面组件 `export default function SettingsPage()`

**行为规范（事实来源 = `vanilla-html/src/pages/settings.ts`）：** 四个 `oas-tab-panel`（appearance 外观 / layout 布局与导航 / data 数据与列表 / notification 通知），每个控件的持久化键、生效方式（主题色即时写 `--oas-color-primary` 并按明暗分键存储、监听 `'themechange'`；圆角写 `--oas-radius-md`；密度/字号调 `applyDensity()/applyFontSize()`；布局矩阵点击调 `setMenuStyle/Position` 并派 `'oas:navconfig-change'`；路由模式切换 `modal.confirm` 二次确认后整页刷新；data/通知 Tab 仅持久化 + `appMessage.success`）逐项对齐。`oas-segmented#settings-tabs-layout` 切 tab 横竖排保留。重置按钮清 4 键并 `removeProperty`。

- [ ] **Step 1: 复制 settings.css，实现 settings.tsx**

表单类控件（`oas-color-picker`/`oas-slider`/`oas-radio`/`oas-select`/`oas-switch`/`oas-theme-editor`）的 `oas-change` 事件全部走 `useOasEvent`；受控值用 `useState` 初始化自 `readXxx()`。

- [ ] **Step 2: 补充 elements.d.ts**（`oas-color-picker` `oas-slider` `oas-radio` `oas-segmented` `oas-theme-editor`）

- [ ] **Step 3: 验证**

```bash
pnpm --filter admin-pro-react test && pnpm --filter admin-pro-react build
# 手动 dev：改主题色 → 全站即时变色且刷新后保持；切明暗主题 → 各自记色；布局矩阵切换 → 壳实时重建
```

- [ ] **Step 4: Commit**

```bash
git add templates/admin-pro/react
git commit -m "feat(admin-react): 设置中心页（外观/布局/数据/通知四 Tab）"
```

---

### Task 7: 页面第一批——login + dashboard

**Files:**
- Create: `src/pages/login.tsx`（双版式 split/glass，URL `?style=glass`）
- Create: `src/pages/dashboard.tsx`

**Interfaces:**
- Consumes: Task 2 `data/dashboard` + `data/products` + `session` + i18n；Task 3 全部
- Produces: `export default function LoginPage()`、`export default function DashboardPage()`

**行为规范：** `login.ts`（148 行：oas-form 登录、`oas-enter` 事件、登录即 `session.login()` 本地直登、双版式）、`dashboard.ts`（390 行：统计卡 + `oas-chart` 7/14/30 天联动 + skeleton 加载 + 最近订单表格）逐块对齐。登录后跳转：`session.login()` 触发 AppRouter 未登录分支消失，进入 `/dashboard`。

- [ ] **Step 1: login.tsx**（`oas-submit` 走 `useOasEvent`；跨 shadow 提交用 `formRef.current?.shadowRoot?.querySelector('form')?.requestSubmit()`——playground 实测模式）
- [ ] **Step 2: dashboard.tsx**（`oas-chart` 的 `options`/`series` 等数据 prop 走 JSON attribute；`useEffect` 拉 `listProducts()` 等异步数据进 state；7/14/30 切换 `oas-segmented` 的 `oas-change` 走 `useOasEvent`）
- [ ] **Step 3: 补充 elements.d.ts**（`oas-skeleton` `oas-empty` `oas-table` `oas-progress`）
- [ ] **Step 4: 验证 + Commit**

```bash
pnpm --filter admin-pro-react test && pnpm --filter admin-pro-react build
# 手动 dev 全流程：未登录 → /login → 登录 → dashboard 图表渲染、天数切换联动
git add templates/admin-pro/react && git commit -m "feat(admin-react): login + dashboard 页"
```

---

### Task 8: 页面第二批——products + product-edit（完整 CRUD）

**Files:**
- Create: `src/pages/products.tsx`、`src/pages/product-edit.tsx`
- Create: `src/pages/product-columns.ts`（从 vanilla 复制适配——列定义是纯数据 + `*.test.ts` 一并移植）
- Create: `src/styles/pages/products.css`（从 vanilla 复制）

**Interfaces:**
- Consumes: Task 2 `data/products` 全 CRUD + `stockLevel` + `data/categories` + `settings-init`（`readFormMode`/`readPageSize`）
- Produces: `export default function ProductsPage()`、`export default function ProductEditPage()`

**行为规范：** `products.ts`（755 行，**全计划最大页面**）：卡片/列表双视图、dialog/drawer/page 三表单模式（读 `readFormMode()`）、批量删除/批量上下架、列设置持久化、分页读 `readPageSize()`。逐块对齐 vanilla。`product-edit.ts`（186 行，`oas-page-header` + 表单）复用 products.css。

实现提示：`oas-table` 的 `columns`/`data` 走 JSON attribute；`oas-sort-change`/`oas-row-click`/分页 `oas-change`/`oas-popconfirm` 确认等事件全部 `useOasEvent`；编辑回填用 `useState` 持有当前行。

- [ ] **Step 1: 移植 product-columns.ts + 测试** → `vitest run src/pages/product-columns.test.ts` 绿
- [ ] **Step 2: products.tsx**（建议拆 `products-table.tsx` / `product-form.tsx` 子组件，单文件不超 400 行）
- [ ] **Step 3: product-edit.tsx**
- [ ] **Step 4: 补充 elements.d.ts**（`oas-masonry` `oas-pagination` `oas-checkbox` `oas-popconfirm` `oas-input-number` `oas-date-picker` `oas-upload` `oas-page-header`）
- [ ] **Step 5: 验证 + Commit**

```bash
pnpm --filter admin-pro-react test && pnpm --filter admin-pro-react build
# 手动 dev：双视图切换、三表单模式、批量操作、列设置、分页、新建/编辑/删除全链路
git add templates/admin-pro/react && git commit -m "feat(admin-react): products CRUD + product-edit 页"
```

---

### Task 9: 页面第三批——advanced-form / data-board / users / profile / forbidden / not-found

**Files:**
- Create: `src/pages/advanced-form.tsx`、`src/pages/data-board.tsx`、`src/pages/users.tsx`、`src/pages/profile.tsx`、`src/pages/forbidden.tsx`、`src/pages/not-found.tsx`
- Create: `src/styles/pages/{advanced-form,data-board}.css`（从 vanilla 复制）

**Interfaces:**
- Consumes: Task 2 `data/adv-form`/`data/board`/`data/users`/`data/system`/`session`；Task 3 全部
- Produces: 六个页面默认导出组件

**行为规范：** 对应 vanilla 页面逐块对齐（体量与组件清单见 spec 调研：advanced-form 214 行 17 种表单控件；data-board 134 行水印/数字动画/图表；users 553 行表格 + 详情 descriptions + modal 表单 + 角色权限；profile 146 行；forbidden/not-found 各 27 行——按本计划「移植总原则」的范例骨架写）。users 页建议拆 `users-table.tsx` / `user-form.tsx` 子组件。

- [ ] **Step 1: forbidden + not-found**（最小页面，先打样验证模式）
- [ ] **Step 2: advanced-form + data-board**
- [ ] **Step 3: users + profile**
- [ ] **Step 4: 补充 elements.d.ts**（`oas-auto-complete` `oas-cascader` `oas-combobox` `oas-tree-select` `oas-transfer` `oas-dynamic-tags` `oas-pin-input` `oas-rate` `oas-watermark` `oas-statistic` `oas-number-animation` `oas-descriptions` `oas-descriptions-item` `oas-divider`）
- [ ] **Step 5: 验证 + Commit**

```bash
pnpm --filter admin-pro-react test && pnpm --filter admin-pro-react build
git add templates/admin-pro/react && git commit -m "feat(admin-react): advanced-form/data-board/users/profile/错误页"
```

---

### Task 10: e2e 移植 + 整站构建验证

**Files:**
- Create: `e2e/smoke.spec.ts`、`e2e/tabs.spec.ts`、`e2e/settings.spec.ts`、`e2e/products.spec.ts`（从 vanilla 对应 spec 移植——vanilla 的设置用例分散在 products/profile spec，本模版集中为 settings.spec，覆盖：form-mode 写入、tabs-bar 开关、font-size 持久化、主题色即时作用于 `--oas-color-primary`、主题色按明暗独立存储、viewer 可访问设置中心）

**Interfaces:**
- Consumes: 全部前序任务
- Produces: 可用的 `pnpm test:e2e`

移植规则：断言语义逐条对齐 vanilla spec；**选择器适配**是主要工作——vanilla 的 DOM 结构类名已在 Task 5 对齐（`.ptab`、`[data-ptab-close]` 等），shadow DOM 穿透断言（`[part=ok]`、`.dialog` 等）原样保留；页面跳转断言 URL 从 vanilla 的 hash 形式核对（同为 hash，应逐字可用）。

- [ ] **Step 1: smoke.spec.ts**（7 例：未登录重定向、admin 登录见仪表盘、用户管理新建/删除含 popconfirm shadow 断言、viewer 403、主题切换 `data-theme=dark`、console 零报错）
- [ ] **Step 2: tabs.spec.ts**（7 例：页签累积/active 同步/关闭切相邻/隐藏路由归父/首页无关闭钮/关闭其他/关闭全部）
- [ ] **Step 3: settings.spec.ts + products.spec.ts**
- [ ] **Step 4: 运行 e2e**

```bash
pnpm --filter admin-pro-react test:e2e
```

Expected: 全绿（需本地 Chromium；如个别用例因 React 渲染时序 flaky，允许在 spec 内加显式 `expect.poll`/`waitFor`，禁止简单 `waitForTimeout` 堆叠）

- [ ] **Step 5: 聚合构建 + size**

```bash
pnpm site                                # 自动发现 react 模版并打包到 site/dist/admin-pro/react/
pnpm --filter admin-pro-react size
```

Expected: `pnpm site` exit 0；size 输出正常

- [ ] **Step 6: Commit**

```bash
git add templates/admin-pro/react
git commit -m "test(admin-react): e2e 四 spec（smoke/tabs/settings/products）"
```

---

## 收尾（控制器执行，不在 subagent 任务内）

- Vue 模版在 Task 2 完成后启动（复制 `src/api` `src/data` `src/store` `src/i18n` + `settings-init.ts` `layout-config.ts` `error.ts`）
- 门户首页两张卡片 + README 表格 + lockfile 在 React/Vue 都完成后统一加
