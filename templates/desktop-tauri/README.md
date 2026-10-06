# desktop-tauri —— 桌面端交付模板（立项章程）

> 状态：**已立项（2026-10-06），M0 可行性验证未开始**
> 定位：模板仓第 8 个交付形态——把 admin-pro 后台装进原生桌面窗口（非浏览器）。

## 1. 背景与定位

oas-ui 是标准 web components，天然可嵌入桌面容器。仓库已有两种交付形态：
admin-pro（桌面后台 × 6 技术栈）、mobile-h5（移动 H5）。桌面端补齐后覆盖
「后台 / 移动 / 桌面」三端。**这是独立交付形态，不是 admin-pro 的子目录**
（同 mobile-h5 立项口径：壳层物种不同——原生窗口/菜单/托盘/文件系统/多窗口）。

## 2. 技术选型（已定夺）

| 维度 | **Tauri 2（选定）** | Electron（备选） |
|---|---|---|
| 产物体积 | ~10MB 级 | 150MB+ |
| 安全模型 | 默认最小权限 + Rust 后端 | Node 全权 |
| 前端复用 | 零改造（webview2/WebKit） | 零改造 |
| 生态 | 自动更新/托盘/插件齐备，趋势向上 | 最成熟 |
| 代价 | 需 Rust 工具链 | 需维护主进程 JS |

## 3. 壳层选型

**vanilla-html**（零框架、无构建运行时假设）为内嵌后台。首版仅内嵌 + 桌面化
增强，不做六范式移植。

## 4. 范围

### v0（M0-M1，骨架可跑）
- Tauri 2 + vanilla admin 内嵌，窗口/缩放/图标可用
- 原生应用菜单（文件/视图/帮助最小集）+ 窗口标题联动路由
- dev 模式（tauri dev 代理模板 vite）+ build 产物（exe/msi）

### v1（M2，桌面化）
- 系统托盘（显示/隐藏窗口）
- 深浅色跟随系统、`oas-*` 组件无障碍行为复核（webview 差异）
- 窗口状态持久化（尺寸/位置）

### 明确不做（首版）
- 自动更新 / 代码签名（分发策略定后再议）
- 多窗口、文件系统深集成、离线数据层

## 5. 里程碑与验收

| 里程碑 | 内容 | 验收 |
|---|---|---|
| M0（≈0.5 天） | 可行性 spike：本机 `tauri init` + vanilla 内嵌 + 出一个 exe | exe 打开可见完整后台、表格/弹窗/主题可用 |
| M1 | 模板骨架成目录（templates/desktop-tauri）+ dev/build 脚本 + e2e（tauri webdriver） | `pnpm --filter desktop-tauri build` 出安装包；e2e 绿 |
| M2 | 桌面化清单（托盘/菜单/状态持久化） | 清单项逐条演示通过 |
| M3 | 三平台 CI 矩阵 | CI 产物三平台可装 |

## 6. 风险与依赖

- **Rust 工具链**：M0 前置（rustup + MSVC build tools）；CI 需三平台 runner
- **webview 差异**：Windows WebView2 / macOS WKWebDriver 的组件行为回归需入 e2e
- **CDN 版不适用**：桌面模板基于打包范式（vanilla），不涉及 unpkg
- **上游联动**：无（web components 与容器解耦）

## 7. 目录规划（M1 落位）

```
templates/desktop-tauri/
  src/            # vanilla admin 内嵌（引 @oas-ui/*）
  src-tauri/      # Tauri Rust 壳（窗口/菜单/托盘）
  e2e/            # webdriver 用例
  README.md       # 本章程 + 使用说明
```
