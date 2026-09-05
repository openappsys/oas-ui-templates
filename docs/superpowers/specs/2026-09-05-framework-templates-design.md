# React / Vue 模版设计：admin-pro 框架模版

日期：2026-09-05
状态：已获用户批准（半并行执行方式）
范围：新增 `templates/admin-pro/react` 与 `templates/admin-pro/vue` 两个模版；门户首页加两张卡片

## 背景与目标

oas-ui 是框架无关的 Web Components 组件库，但仓库目前只有 vanilla / cdn 系模版，缺少「在 React / Vue 里怎么用」的直接证据。新增两个框架模版，把 oas-ui 仓库 `packages/playground` 实测的框架差异结论（事件桥接、属性通道、message API）产品化为开箱即用的封装。

与 playground 的分工：playground 留在 oas-ui 仓库做机制回归场（private、workspace 链接）；本模版面向使用者（npm 发布版依赖、可 degit、挂门户 demo）。

## 已确认的关键决策

| 决策点 | 结论 |
| --- | --- |
| 功能范围 | **机制全对齐 vanilla + 页面子集**（10 个代表性页面，不做 26 页全量复刻） |
| 技术路线 | **Vite 纯 CSR**（hash 路由，可挂门户静态站；不做 SSR） |
| 执行方式 | **半并行**：React 全量先行；纯 TS 层（api/data/i18n）定稿后 Vue 启动并复制该层，框架特有部分各自独立 |
| 顺序 | 先 React 后 Vue |
| 状态库 | 不引第三方状态库（React 用 Context + useReducer；Vue 用 `reactive` 轻量 store） |

## 目录结构（两端同构，镜像 vanilla）

```
templates/admin-pro/<framework>/
  package.json  vite.config.ts  tsconfig.json
  src/
    api/        # 请求层（request/http/auth），纯 TS，从 vanilla 移植
    components/ # app-shell 布局壳、progress 等
    data/       # mock 数据层，纯 TS 移植
    hooks/      # （react）useOasEvent / useT 等    ─┐ 框架特有
    composables/ # （vue）useOasEvent / useT 等      ─┘
    i18n/       # @oas-ui/i18n + 框架 binding
    pages/      # 页面子集
    router/     # 路由 + 权限守卫 + 多页签
    store/      # 会话/设置，localStorage 持久化
    styles/     # 移植 vanilla CSS
  e2e/          # playwright spec
```

## 框架集成封装层（核心价值）

**React 版**：
- `elements.d.ts`：React 19 `JSX.IntrinsicElements` 全量类型声明，`<oas-*>` 标签类型化
- `useOasEvent(ref, 'oas-submit', handler)`：解决 React 19 不自动桥接 kebab 自定义事件的实测坑（playground 结论）
- `appMessage`：封装 `@oas-ui/ui` 的 `message` 命令式 API 统一入口
- 路由：react-router hash 模式

**Vue 版**：
- vite plugin-vue 配 `compilerOptions.isCustomElement`（`/^oas-/`）
- `GlobalComponents` 类型声明（`@oas-ui/ui` 组件标签类型化）
- Vue 原生支持 `@oas-submit` 等事件绑定，无需桥接层；`appMessage` 封装同 React 版
- 路由：vue-router hash 模式

## 机制全对齐清单（对 vanilla-html）

| vanilla 机制 | React 对应 | Vue 对应 |
| --- | --- | --- |
| 请求层（拦截/错误/重试） | 纯 TS 移植 | 同左（复制） |
| 权限守卫 | router 守卫 + session store | 同左 |
| i18n 中英切换 | `@oas-ui/i18n` + `useT()`，切语言同步 `documentElement.lang` | 同左（组合式函数版） |
| 多页签 | 页签条记录打开历史，切换=切路由；**不缓存页面内部状态**（keep-alive 不进模版） | 同左 |
| 设置中心（外观/布局/数据/通知四 Tab，持久化） | settings store + 主题色即时写 `--oas-color-primary` | 同左 |
| 可配置导航（sidebar/menubar/navigation × 左/右/顶） | app-shell 读 layout-config 切布局模式 | 同左 |
| 登录 + 路由拦截 | login 页 + 守卫 | 同左 |

两端功能对齐原则沿用 playground 惯例：结构一致、页面一致，便于对照定位「框架问题 vs 组件问题」。

## 页面子集（11 个，两端一致）

`login`、`dashboard`、`products` + `product-edit`（完整 CRUD）、`advanced-form`、`data-board`、`users`、`profile`、`settings`、`forbidden`（权限守卫证据）、`not-found`

## 测试

- 单测（vitest）：`api/`、`data/`、`store/` 纯逻辑测试从 vanilla 直接移植
- e2e（playwright）：移植核心 4 个 spec——`smoke`、`tabs`、`settings`、`products`

## 门户集成

- `pnpm site` 自动发现两个新模版（vite `base: './'`，hash 路由无需 fallback）
- 门户首页 `site/index.html` 新增两张卡片（admin-pro / react、admin-pro / vue），样式沿用现有卡片 + 蓝色系配色；卡片 SVG 示意图最后统一加，避免并行冲突
- README 模版表格加两行

## 明确不做（YAGNI）

- 不做 SSR / Next / Nuxt 版本（门户静态站挂不了，留给官方插件文档）
- 不做 26 页全量复刻；不做页签 keep-alive
- 不引第三方状态库、组件库封装层（不建 `<OasButton>` wrapper 组件层）
- 不动 `vanilla-html` / `cdn` / `cdn-mpa` 任何文件

## 执行编排（半并行）

1. **阶段一（React 全量）**：plan → 实现 → 审查，直到纯 TS 层（api/data/i18n）+ 一个完整页面链路定稿
2. **阶段二（Vue 启动）**：复制纯 TS 层，独立实现 vue-router / composables / `.vue` 页面；React 剩余部分继续推进
3. **阶段三（收口）**：由我统一加门户卡片 + README + lockfile 合并，避免并行冲突

## 风险

- **版本漂移**：模版依赖 npm 发布版 `@oas-ui/*`，oas-ui 发版后需跟进（README 已有版本节奏先例）
- **两端漂移**：页面子集与机制清单已锁定一致；收口阶段对照检查
