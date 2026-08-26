# admin-pro / vanilla-html

基于 [oas-ui](https://oas-ui.dev) Web Components 的后台管理模版：TypeScript + Vite，零框架运行时。

功能：双登录形态（分屏品牌墙 / 玻璃拟态，默认 `?style=split`，可用 `?style=glass` 切换）· 登录（角色：管理员 / 只读访客）· hash 路由权限守卫 · 路由切换顶部全局进度条 · 仪表盘（统计卡 + oas-chart 图表 + 最近订单 + 热销商品 Top5）· 多页签导航（顶栏多开页面 + 右键批量关闭菜单）· Command 面板（Ctrl+K 新页直达）· 通知中心 · 全屏 · 用户管理（搜索 / 筛选 / 分页 / 弹窗 CRUD / 空态 / popconfirm 删除确认）· 订单管理（tabs 筛选 / 状态流转抽屉 / CSV 导出）· 商品管理（卡片网格 / 上下架开关 / 新建抽屉表单，分类选项来自分类数据源）· 商品分类管理（/system/category CRUD）· 分步表单向导 · 订单详情 · 结果页 · 403/404/500 结果页 · 基础表单页 · 个人中心（外观三主题卡）· i18n 中英切换（壳层即时生效）· fetch 请求层（拦截器 / 超时 / 本地 `/api/*` mock）· 侧栏分组（总览 / 业务 / 系统 / 示例）· 侧栏图标主题色着色（`nav-*` 彩色 SVG）· light/dark/system 主题 · 移动端抽屉侧栏 · demo 数据 localStorage 持久化（刷新不丢，清 storage 即重置）。

## 使用

```bash
pnpm install   # 或 npm i
pnpm dev       # http://localhost:5173
```

取用本模版：

```bash
npx degit <本仓库地址>/templates/admin-pro/vanilla-html my-admin
```

## 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发服务器 |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm test` | vitest 单测（路由守卫 / 会话 / 数据源） |
| `pnpm test:e2e` | Playwright e2e（登录 / 权限 / CRUD / 主题） |
| `pnpm size` | 构建产物 gzip 体积门禁 |

## 结构

- `src/router/`：hash 路由 + 权限守卫（纯函数，可单测）
- `src/router/tabs.ts`：多页签状态纯函数（`visit`/`closeTab`/`closeKeys`/`closeAll`/`tabKeyOf`，隐藏路由归属父级、首页固定不可关）
- `src/store/session.ts`：模拟会话（localStorage 持久化）；接真后端时替换此文件
- `src/i18n/`：应用词条（zh/en）与 locale 切换/订阅；词条合并到 @oas-ui/i18n 内置词条之上
- `src/api/`：fetch 请求层（拦截器 / 超时 / query）+ auth 信封解析 + 本地 `/api/*` mock
- `src/settings-init.ts`：设置持久化 key / reader 与启动时 `applySettings()`（主题色 / 圆角 / 表格密度）——渲染页与启动逻辑共享，避免静态导入拖入设置页 chunk
- `src/data/store.ts`：localStorage 持久化小工具（persist / restore，坏 JSON 回退种子）
- `src/data/users.ts` / `orders.ts` / `products.ts` / `notifications.ts`：内存 mock 数据源（CRUD + 100ms 模拟延迟 + localStorage 持久化）；接真后端时替换
- `src/components/registry.ts`：组件按需注册清单
- `src/components/app-shell.ts`：oas-layout 外壳（侧栏 / 顶栏 / 主题切换 / 语言切换 / 用户菜单）
- `src/components/progress.ts`：路由切换顶部全局进度条（`start()` / `done()`，body 级独立覆盖层，不侵入 oas-layout）
- `src/components/sidebar-icons.ts`：注册 `nav-*` 彩色侧栏图标（复用 @oas-ui/icons 几何 + 主题色 stroke）
- `src/pages/`：页面模块，契约 `render(el) => dispose`
- `scripts/size.mjs`：构建产物 gzip 体积门禁

## 国际化 i18n

- 顶栏语言切换器（简体中文 / English），选择写入 `localStorage['oas-admin.locale']`，默认 zh-CN
- 壳层（document.title / 顶栏 / 侧栏 / 页脚）切换即时重渲染；业务页面仅重新进入或刷新后应用新语言
- 取词 `t()`，切换 `setLocale()`，订阅 `onLocaleChange()`；新增语言在 `src/i18n/` 加词条文件并 `registerLocale`

## 请求层

- `src/api/request.ts`：`createHttp` 工厂 — baseURL / 超时 / 拦截器（onRequest / onResponse / onError）/ query 参数拼装 / AbortSignal 合并
- `src/api/http.ts`：`http` 单例（baseURL `/api`、8s 超时、注入 Authorization、网络错误 toast）；`enableFakeFetch()` 把 `/api/*` 请求降级到本地 mock
- `src/api/auth.ts`：业务 API 示例 — 解析 `{ code, data, message }` 信封，`code !== 0` 抛错
- 接真后端：见 [`docs/backend-integration.md`](docs/backend-integration.md)（关 fakeFetch / 换 baseURL / 替换 data 层）

## 页面

- `/forbidden`、`/not-found`、`/500`：权限守卫 / 未知路由 / 加载失败落地页（`oas-result` 结果态 + 返回首页）
- `/basic-form`：通用卡片表单（input / select / switch / date-picker / upload / textarea + 必填与格式校验）
- `/system/category`：商品分类管理（搜索 / 新建 / 编辑 / 删除，分类数据源 `src/data/categories.ts`）；商品页的分类选项（筛选 / 表单）从该数据源实时拉取，分类页增删改后商品页刷新即同步

## 多页签

- 顶栏下方页签栏（`<oas-tabs type="card" hide-content context-menu>`，`src/components/app-shell.ts`）：已访问页面各一页签，点击切换、关闭按钮、「关闭全部」；仪表盘固定底位不可关
- 状态纯函数在 `src/router/tabs.ts`（`visit` 去重 + 自动补首页、`closeKeys` 批量关闭、`tabKeyOf` 隐藏路由归属父级）——纯函数可单测
- **右键页签**：复用 oas-tabs 的 `context-menu` —— 新建 / 关闭 / 关闭其他 / 关闭左侧所有 / 关闭右侧所有 / 关闭全部（`oas-close` 批量派发经 `queueMicrotask` 攒批由 `closeKeys` 处理）；词条用 @oas-ui/i18n 内置 `tabs.ctxClose*` 系列
- 隐藏路由（`meta.hidden`：明细/结果/编辑页）不新增独立页签，归到 `meta.parent`（如 `/order-detail` → `/orders`）

## 侧栏图标

- 侧栏菜单图标用 `@oas-ui/icons` 内置 SVG 名（非 emoji），路由 `meta.icon` 指向标准图标名（`star`/`calendar`/`edit`/`index` 等）
- **项级着色**：路由 `meta.iconColor`（任意 CSS 色值，如 `var(--oas-tint-cyan)`）经 `SidebarItem.iconColor` 写入 oas-sidebar，`iconSvg` 渲染时 `stroke="{iconColor || 'currentColor'}"`——**随 light/dark 主题换肤自适应**，active 项仍由组件主色高亮兜底

## 网站 / 发布

本模版作为 `oas-ui-templates` 仓库的一员，会被聚合进**门户站**：仓库根 `pnpm site` 逐模版构建后，本模版构建产物拷贝到 `site/dist/admin-pro/vanilla-html/`（子路径）。

- 模版 vite 用 `base: './'`（相对路径 asset），可挂任意子路径，不影响本地 dev / 单测 / e2e
- 发布到 Cloudflare Workers（wrangler 静态资产站）：见仓库根 README「网站 / 发布」节（`wrangler.jsonc` 的 `assets.directory` 指向 `site/dist`）

## CI

- `.github/workflows/ci.yml`：matrix 由 `template` 列表驱动，新增模版 = 在列表追加一行（name / workdir / size / e2e 开关）
- 每 push / PR：install + tsc + test + build（+ size / e2e 按行启用）；每周一 03:00 UTC 定时 + oas-ui 发版 repository_dispatch 触发依赖升级复测

## 已知边界

- 页面 chunk 加载失败（`import()` reject / 渲染抛错）时整页兜底为 500 结果态（`src/router/router.ts` 的 `runResolve`），不会部分渲染
- demo 数据 localStorage 持久化，清除 storage（或 `resetXxx`）即重置；接真后端时替换 data 层
- 登录形态默认分屏品牌墙（`?style=split`），可通过 `?style=glass` 切换为玻璃拟态

## Roadmap

- 移动端专项：触摸目标 / hover 依赖降级 / 浮层视口适配 / 安全区（当前桌面优先，需系统性移动审计）
- 页面渲染错误边界已实现（`src/error.ts` 上报 + router 按页 `renderPageError` 重试）；错误上报接口 `reportError` / `setErrorReporter` 已提供，接监控时替换 reporter 即可
