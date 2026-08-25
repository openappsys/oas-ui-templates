# admin-pro / vanilla-html

基于 [oas-ui](https://oas-ui.dev) Web Components 的后台管理模版：TypeScript + Vite，零框架运行时。

功能：双登录形态（分屏品牌墙 / 玻璃拟态，默认 `?style=split`，可用 `?style=glass` 切换）· 登录（角色：管理员 / 只读访客）· hash 路由权限守卫 · 仪表盘（统计卡 + ECharts + 最近订单 + 热销商品 Top5）· Command 面板（Ctrl+K 新页直达）· 通知中心 · 全屏 · 用户管理（搜索 / 筛选 / 分页 / 弹窗 CRUD / 空态 / popconfirm 删除确认）· 订单管理（tabs 筛选 / 状态流转抽屉 / CSV 导出）· 商品管理（卡片网格 / 上下架开关 / 新建抽屉表单）· 分步表单向导 · 订单详情 · 结果页 · 个人中心（外观三主题卡）· light/dark/system 主题 · 移动端抽屉侧栏 · demo 数据 localStorage 持久化（刷新不丢，清 storage 即重置）。

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
- `src/data/store.ts`：localStorage 持久化小工具（persist / restore，坏 JSON 回退种子）
- `src/data/users.ts` / `orders.ts` / `products.ts` / `notifications.ts`：内存 mock 数据源（CRUD + 100ms 模拟延迟 + localStorage 持久化）；接真后端时替换
- `src/components/registry.ts`：组件按需注册清单
- `src/components/app-shell.ts`：oas-layout 外壳（侧栏 / 顶栏 / 主题切换 / 用户菜单）
- `src/pages/`：页面模块，契约 `render(el) => dispose`
- `scripts/size.mjs`：构建产物 gzip 体积门禁

## 已知边界

- demo 数据 localStorage 持久化，清除 storage（或 `resetXxx`）即重置；接真后端时替换 data 层
- 侧栏激活高亮由组件内部点击自管理；程序化改 hash（登录后跳转）不保证高亮同步
- 登录形态默认分屏品牌墙（`?style=split`），可通过 `?style=glass` 切换为玻璃拟态

## Roadmap

- i18n（zh/en 切换）
- 请求层抽象（fetch + 拦截器示例）
