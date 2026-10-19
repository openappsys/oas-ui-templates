# oas-ui-templates 工作规范

## 改码验证流程（强制，按序执行，不得跳步）

每次修改代码后，必须按以下顺序完整走完，任何一步失败先修复再继续：

1. **语法与格式检查**：`pnpm exec biome check --write <范围>` + `pnpm --filter <pkg> run build`（含 tsc 类型检查），0 error 才继续
2. **构建**：`pnpm --filter <pkg> run build` 通过
3. **e2e 测试**：`pnpm --filter <pkg> run test:e2e` 全绿（新功能必须补对应 e2e）
4. **截图验收**：界面改动必须截图人工核对视觉（`_shots.spec.ts` 模式），不凭想象确认
5. **站点部署**：`pnpm site` 重新构建部署（门户产物同步最新）
6. **提交**：git commit（信息说明「做了什么 + 修了什么根因」）

**验证深度按影响面分层**（日常执行，收尾/推送前不适用）：
- 数据层 `data/**`、权限、keyboard/App 壳、依赖变更 → **全量 e2e**
- 纯样式/app.css（无 DOM·testid 变化）→ biome + build + 相关视图截图，跳过 e2e
- 单一视图局部改动 → biome + build + 该视图相关 e2e 子集（`playwright test <spec> [--grep]`）
- 纯 chore（注释/格式化/死代码删除）→ 仅 biome
- 未改动模板一律不跑（`pnpm --filter <pkg>` 天然满足）；全仓 `pnpm check` 留给收尾

## 红线

- **不留任何 bug 才算完成**——e2e 全绿 ≠ 没问题，需截图/人工验收界面
- **用组件库前先查 API**（`node_modules/.pnpm/@oas-ui+ui@*/.../dist/types/**.d.ts` 与 docs），以应用尽用，没有的自己造
- **Web Components 与 React 19 集成的已知坑**（遇到先对照）：
  - `title` 等全局属性命中 HTMLElement 原生 property → React 走 property 不落 attribute，组件收不到（用 ref + setAttribute）
  - `options` 类数据通道：组件渲染签名可能只看 attribute（如 oas-segmented），property setter 仅内存持有；oas-select 的 setter 会转 attribute——逐组件确认
  - `oas-input/oas-textarea` 等 value 走 property（React 19 分派自动命中）
  - Dexie compound index 首字段必须声明独立索引，否则 SchemaError 全库打不开
  - shadow DOM 内的元素：`document.querySelector` 查不到，Playwright locator 可穿透；light CSS 不生效，需注入 shadow root 或 inline style
  - **document 级 keydown 的 e.target 被 shadow retarget 到宿主**：`closest('input…')` 不命中 oas-input 内部输入框——键盘守卫用 `composedPath()` 扫（`lib/keyboard.ts` 已内置）
  - **oas-modal 的 close() 同步移除 visible，`oas-close` 事件延迟到 rAF**：受控组件收敛 state 需监听 `oas-before-close`（可被 preventDefault 取消，handler 先查 `defaultPrevented`）
  - **oas-drawer/oas-modal 吸收宿主 title attribute**（titleCache 后 removeAttribute）——运行时读取/e2e 断言别用 title，用渲染内容（如 `.detail-title`）
  - **oas-empty 吸收 title 但保留 description attribute**；e2e 断言走 `toHaveAttribute('description', …)`
  - **oas-checkbox**：原生 change 不穿 shadow，宿主监听 `oas-change`（detail `{checked, value}`）；宿主 click 双发（直派+内部冒泡）——toggle 挂 `oas-change`、stopPropagation 挂 `click`
  - **oas-skeleton**：`title` 属性同样被吸收；`effect` 缺省 `none` 无动画（要动效显式传 `pulse`/`sheen`）
  - **oas-chart 是 width 驱动等比缩放**（shadow `svg{width:100%;height:auto}`，viewBox 520×280）：宿主定高必溢出/裁剪——宿主用 `aspect-ratio: 520/280` 跟随；「x 轴标签消失」先量宿主与 SVG 实际几何（标签常被画到宿主区域外），勿直接归因抽稀算法
  - **oas-list 数据通道行在 shadow 内**：宿主自绘行样式需注入 shadow stylesheet（参照 VirtualIssueList/SideList 模式）；数据重挂会整树重建——焦点需按 testid 恢复（SideList 已内置）
- **PowerShell 陷阱**：`[System.IO.File]`/`[System.IO.File]::ReadAllText` 相对路径不跟随 Set-Location——文件操作一律绝对路径或用 Write/Edit 工具；大段文本处理用 node 脚本文件（`node -e` 多行转义易炸）
- **e2e 断言**：状态变更类操作避免 from===to 无 diff 不落库的 flaky（先读当前值选不同值）；共享 IndexedDB 的测试 workers=1 串行
