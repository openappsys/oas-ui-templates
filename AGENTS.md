# oas-ui-templates 工作规范

## 改码验证流程（强制，按序执行，不得跳步）

每次修改代码后，必须按以下顺序完整走完，任何一步失败先修复再继续：

1. **语法与格式检查**：`pnpm exec biome check --write <范围>` + `pnpm --filter <pkg> run build`（含 tsc 类型检查），0 error 才继续
2. **构建**：`pnpm --filter <pkg> run build` 通过
3. **e2e 测试**：`pnpm --filter <pkg> run test:e2e` 全绿（新功能必须补对应 e2e）
4. **截图验收**：界面改动必须截图人工核对视觉（`_shots.spec.ts` 模式），不凭想象确认
5. **站点部署**：`pnpm site` 重新构建部署（门户产物同步最新）
6. **提交**：git commit（信息说明「做了什么 + 修了什么根因」）

## 红线

- **不留任何 bug 才算完成**——e2e 全绿 ≠ 没问题，需截图/人工验收界面
- **用组件库前先查 API**（`node_modules/.pnpm/@oas-ui+ui@*/.../dist/types/**.d.ts` 与 docs），以应用尽用，没有的自己造
- **Web Components 与 React 19 集成的已知坑**（遇到先对照）：
  - `title` 等全局属性命中 HTMLElement 原生 property → React 走 property 不落 attribute，组件收不到（用 ref + setAttribute）
  - `options` 类数据通道：组件渲染签名可能只看 attribute（如 oas-segmented），property setter 仅内存持有；oas-select 的 setter 会转 attribute——逐组件确认
  - `oas-input/oas-textarea` 等 value 走 property（React 19 分派自动命中）
  - Dexie compound index 首字段必须声明独立索引，否则 SchemaError 全库打不开
  - shadow DOM 内的元素：`document.querySelector` 查不到，Playwright locator 可穿透；light CSS 不生效，需注入 shadow root 或 inline style
- **PowerShell 陷阱**：`[System.IO.File]`/`[System.IO.File]::ReadAllText` 相对路径不跟随 Set-Location——文件操作一律绝对路径或用 Write/Edit 工具；大段文本处理用 node 脚本文件（`node -e` 多行转义易炸）
- **e2e 断言**：状态变更类操作避免 from===to 无 diff 不落库的 flaky（先读当前值选不同值）；共享 IndexedDB 的测试 workers=1 串行
