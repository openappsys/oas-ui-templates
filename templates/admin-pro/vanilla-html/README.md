# admin-pro / vanilla-html

基于 [oas-ui](https://oas-ui.dev) Web Components 的后台管理模版：TypeScript + Vite，零框架运行时。

功能：双登录形态（分屏品牌墙 / 玻璃拟态，默认 `?style=split`，可用 `?style=glass` 切换）· 登录（角色：管理员 / 只读访客）· hash 路由权限守卫 · 仪表盘（统计卡 + ECharts + 最近订单 + 热销商品 Top5）· Command 面板（Ctrl+K 新页直达）· 通知中心 · 全屏 · 用户管理（搜索 / 筛选 / 分页 / 弹窗 CRUD / 空态 / popconfirm 删除确认）· 订单管理（tabs 筛选 / 状态流转抽屉 / CSV 导出）· 商品管理（卡片网格 / 上下架开关 / 新建抽屉表单）· 分步表单向导 · 订单详情 · 结果页 · 403/404 结果页 · 基础表单页 · 个人中心（外观三主题卡）· i18n 中英切换（壳层即时生效）· fetch 请求层（拦截器 / 超时 / 本地 `/api/*` mock）· light/dark/system 主题 · 移动端抽屉侧栏 · demo 数据 localStorage 持久化（刷新不丢，清 storage 即重置）。

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
- `src/store/session.ts`：模拟会话（localStorage 持久化）；接真后端时替换此文件
- `src/i18n/`：应用词条（zh/en）与 locale 切换/订阅；词条合并到 @oas-ui/i18n 内置词条之上
- `src/api/`：fetch 请求层（拦截器 / 超时 / query）+ auth 信封解析 + 本地 `/api/*` mock
- `src/data/store.ts`：localStorage 持久化小工具（persist / restore，坏 JSON 回退种子）
- `src/data/users.ts` / `orders.ts` / `products.ts` / `notifications.ts`：内存 mock 数据源（CRUD + 100ms 模拟延迟 + localStorage 持久化）；接真后端时替换
- `src/components/registry.ts`：组件按需注册清单
- `src/components/app-shell.ts`：oas-layout 外壳（侧栏 / 顶栏 / 主题切换 / 语言切换 / 用户菜单）
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
- 接真后端：去掉 main.ts 里的 `enableFakeFetch()`，把 `http` 的 baseURL 指向真实网关即可

## 页面

- `/forbidden`、`/not-found`：权限守卫 / 未知路由落地页（`oas-result` 结果态 + 返回首页）
- `/basic-form`：通用卡片表单（input / select / switch / date-picker / upload / textarea + 必填与格式校验）

## CI

- `.github/workflows/ci.yml`：matrix 由 `template` 列表驱动，新增模版 = 在列表追加一行（name / workdir / size / e2e 开关）
- 每 push / PR：install + tsc + test + build（+ size / e2e 按行启用）；每周一 03:00 UTC 定时 + oas-ui 发版 repository_dispatch 触发依赖升级复测

## 已知边界

- demo 数据 localStorage 持久化，清除 storage（或 `resetXxx`）即重置；接真后端时替换 data 层
- 侧栏激活高亮由组件内部点击自管理；程序化改 hash（登录后跳转）不保证高亮同步
- 登录形态默认分屏品牌墙（`?style=split`），可通过 `?style=glass` 切换为玻璃拟态

## Roadmap

- 500 错误页（页面加载失败兜底）
- 更细的错误边界与错误上报
