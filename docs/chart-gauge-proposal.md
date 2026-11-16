# 提案：oas-chart 新增 gauge 型（ring-liquid 液体环 / dial 仪表盘）

> 状态：草稿（供提交 oas-ui 仓讨论）
> 起草方：oas-ui-templates 仓（admin-pro 模板侧）
> 日期：2026-11-16

## 1. 背景与动机

数据大屏（data screen）场景对「单指标占比/达成率」的可视化有强需求：KPI 卡片、转化率、容量水位、设备负载，普遍采用 gauge 族表达——一个数值 + 一个直观量程读数，信息密度低但视觉冲击强，正好适配大屏的远视距阅读。

`oas-chart` 现有图型清单（oas-ui 仓 HEAD）：`line / bar / pie / area / donut / stacked-bar / radar / polar-area / horizontal-bar` 九型，**无 gauge 族**。donut 表达的是份额构成（part-of-whole），与「单值对量程」的 gauge 心智不同：donut 需要 ≥2 段数据才成立，单值场景被迫补一个占位的第二段，读数还要用户心算百分比。

**存在性证据**：admin-pro 模板在数据大屏落地时被迫自绘了一个 canvas 波浪液体环（`templates/admin-pro/vanilla-html/src/screen/liquid-ring.ts`，约 120 行，2026-11-16 本轮产物）：

- 圆环底槽（`rgba(30,58,95,.6)`，线宽 8）+ 圆内双层正弦波液面，裁剪到环内圆自底部填充至 value% 高度
- 后波 `#0891b2` opacity .6（相位偏移 π/2，深色垫底）/ 前波 `#22d3ee` opacity .9（亮色压上）形成层次
- rAF 驱动：相位每帧 +0.05 流动，数值每帧逼近目标 1%（`approach` 纯函数，不越过目标、双向）
- 波幅 4px（按 dpr 缩放保持视觉常量），波长 = 内半径
- 中央文本槽（数值 `toFixed(1)%` + label）
- `prefers-reduced-motion` 退化为单帧静态绘制（`setValue` 直接落到目标重绘，无循环）
- `visibilitychange` 切后台停 rAF、回前台恢复；`dispose()` 全量清理

这段实现证明了两点：(1) 需求真实且通用（任何 dashboard/大屏都需要）；(2) 自写成本不低——DPR 处理、动效退化、生命周期清理、文本槽布局都是组件库本该承担的职责，每个模板重复自写是浪费。

## 2. 两形态提案

### 2.1 ring-liquid（波浪液位环）

- 触发方式：`type="gauge"` + `options.gaugeStyle: 'liquid'`
- 表达：圆环底槽 + 环内液面高度 = value 占量程比，液面双层正弦波持续流动
- 参数面（自写实现已验证的默认值可作为缺省）：双色波（`colors[0]` 前波 / `colors[1]` 后波，缺省走 token primary 系）、波幅、波长、相位步进、数值逼近步进
- 中央文本槽：数值 + label，显隐/格式可配
- 动效退化：`prefers-reduced-motion` 下静态单帧（快照语义：液面在最终 value 高度，无流动）

### 2.2 dial（仪表盘）

- 触发方式：`type="gauge"` + `options.gaugeStyle: 'dial'`（或 `gaugeStyle` 缺省时的 gauge 默认形态）
- 表达：刻度弧（起止角可配，常见 240°/270°）+ 指针或色带指示当前值 + 峰值标记
- 参数面：量程 `min/max`、分段色带（阈值告警语义，走 token warning/danger）、刻度档数、峰值标记（`options.max` 语义需与 radar 的 max 量程上限区分或复用）
- 中央文本槽同 2.1

两形态共用 `type="gauge"` 入口，差异收敛在 `options.gaugeStyle` 子分支，与现有「顶层 type + options 子集」的 API 心智一致（参照 radar 的 `radarShape`）。

## 3. API 草拟

属性（kebab-case，遵循 oas-chart 现有约定）：

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `'gauge'` | 新增图型值 |
| `value` | number | 当前值，0–100 或 min–max；attribute + property 双通道（property 优先，与 `data` 通道心智一致）；非法值钳到量程 |
| `data` | JSON / property | 兼容现有通道：单值场景可传 `[{label, value}]`，gauge 取 series[0] |
| `options` | JSON / property | 子集见下 |

`options` 新增子集：

```jsonc
{
  "gaugeStyle": "liquid" | "dial",  // 默认 'dial'
  "min": 0,                          // 量程下限，默认 0
  "max": 100,                        // 量程上限（gauge 语义：量程端点；与 radar 的全局量程上限同字段名，文档需消歧）
  "colors": ["#22d3ee", "#0891b2"],  // liquid 双色波；dial 分段色带
  "amplitude": 4,                    // liquid 波幅（px，视觉常量，内部按 dpr 缩放）
  "showLabel": true,                 // 中央文本槽显隐
  "label": "Conversion",             // 中央 label 文案（i18n 缺省口径待定）
  "valueFormat": "percent" | "raw"   // 中央数值格式，默认 'percent'
}
```

事件口径：

- `oas-change`：value 逼近动画到达目标值后派发一次（detail `{ value }`），幂等——与 oas-signature 的「笔画结束派发、幂等」先例一致；宿主高频改写 value 时不 flood
- 文本槽数值随逼近过程逐帧更新是渲染行为，不派发事件

SSR 口径：

- 推荐按 **NOT_SSR 登记**（SSR 客户端专属）处理：`oas-scanner`（getUserMedia）与 `oas-signature`（canvas 笔迹）均以「浏览器专属 API」登记 NOT_SSR，gauge 的 liquid 形态依赖 rAF 连续动画，同属此类
- 备选：若希望纳入 SSR 白名单，则 SSR 快照渲染 value 高度的静态液面/静态指针（动画为客户端增强，水合后启动），参照 `hydrate()` 真水合接管模式——成本更高，收益有限（大屏场景基本无 SSR 需求），倾向不做
- NOT_SSR 计数守恒（白名单 + NOT_SSR = 总数 212 当前口径）需同步登记

ARIA / 空态：沿用 oas-chart 现有口径——容器 `role="img"` + aria-label（组件属性优先，缺省按类型走 i18n）；无/非法数据 → 空态占位。

## 4. 贡献意向

- 模板侧自写实现（`liquid-ring.ts`，含单测覆盖的 `approach` 纯函数、reduced-motion 退化、visibilitychange 生命周期）**可整理后作为 gauge 形态的实现起点向上游贡献**，含单测 / qa-regression e2e / zh/en 文档 / i18n ×16（ar、de、en、es、fa、fr、he、hi、ja、ko、pt-BR、ru、th、uk、zh-CN、zh-Hant）
- **声明替换意向**：官方 gauge 能力发布后，admin-pro 模板将删除 `liquid-ring.ts` 自写实现，替换为 `oas-chart type="gauge"` 官方通道——本提案同时作为模板侧的技术债清偿计划
- 自写实现中的教训可反哺 API 设计：dpr 波幅补偿、`approach` 不越界逼近（双向）、双波相位差 π/2 的层次参数、hidden-at-creation 双调守卫，均已在本模板单测/e2e 中固化

## 5. 验收口径（按 oas-ui 贡献规约）

- **单测**（vitest + happy-dom，TDD RED → GREEN）：
  - 纯函数：波面正弦采样计算（给定相位/波幅/波长/液位的 y 坐标序列）、`approach` 逼近（不越过、双向、已到即停）、量程钳制、options 解析归一
  - 组件层：value 双通道（attribute/property）、oas-change 幂等、reduced-motion 静态退化、dispose 零泄漏、空态
  - 注意 happy-dom 无 canvas 实现（`getContext` 返回 null）——绘制路径需可空跳过，DOM/文本逻辑独立可测（自写实现已踩过此坑）
- **e2e**：qa-regression 新增 `chart.spec.ts`（或并入现有 chart 回归文件）——真实浏览器断言 gauge 两形态渲染、value 受控改写、事件派发、console 零告警；chromium 全量 + firefox/webkit 按跨浏览器抽样规则
- **SSR**：NOT_SSR 登记 + `docs/ssr-matrix.md` / `ssr-matrix.json` 同步，CI 的 SSR 覆盖矩阵防漂移门禁更新
- **文档**：zh/en 组件文档（`gauge` 章节 + live demo）、API 表（`docs/api-descriptions.*.json`）同步
- **i18n ×16**：新增 key 全语种补齐（如 gauge 缺省 aria-label / label 文案）
- **链预算**：gauge 增量计入 chart 链预算档评估（参照 table 链「实测/预算/预警线」口径，在 PR 描述中给出 chart 链增量 KB 数）

## 附：证据索引

| 证据 | 位置 |
| --- | --- |
| 自写液体环实现（~120 行 canvas） | oas-ui-templates 仓 `templates/admin-pro/vanilla-html/src/screen/liquid-ring.ts` |
| oas-chart 现有九型清单 | oas-ui 仓 `packages/ui/src/data/chart/oas-chart.ts` `ChartType` |
| NOT_SSR 先例（scanner/signature） | oas-ui 仓 `CHANGELOG.md`（v2.6.x，SSR 客户端专属条目） |
| SSR 矩阵守恒口径 | oas-ui 仓 `docs/ssr-matrix.md`、`ssr-matrix.json`、`.github/workflows/ci.yml` |
| i18n 16 语种清单 | oas-ui 仓 `packages/i18n/src/locales/` |
| qa-regression / 抽样规则 | oas-ui 仓 `AGENTS.md`、`playwright.config.ts`、`docs/engineering.md` §2 |
