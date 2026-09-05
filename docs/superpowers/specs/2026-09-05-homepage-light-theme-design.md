# 门户首页配色改版设计：浅色主题 + 蓝色系

日期：2026-09-05
状态：已获用户批准
范围：`site/index.html` 单文件

## 背景与目标

门户首页（`site/index.html`）当前为深色（`#0F172A` 底）+ Indigo 紫（`#4F46E5`）配色，用户对配色不满意；布局与文案保持不变。

经浏览器可视化对比（`.superpowers/brainstorm/` 中三轮 mockup）选定方向：

- **浅色主题**（反白，干净通透）
- **主色 `#0B6CFF`**——与模版 demo 实际使用的主题色（`vanilla-html` 登录页等处的 `--oas-color-primary: #0b6cff`）一致，消除门户与子站之间的品牌割裂

## 明确不做（YAGNI）

- 不做深色主题切换（不加 toggle、不保留旧深色配色、不加 `prefers-color-scheme` 分支）
- 不改 HTML 结构、文案、i18n 字典、JS 逻辑、打字机终端动效
- 不动 `templates/` 下任何模版

## 配色 token 变更（`:root`）

| token | 旧值（深色） | 新值（浅色） |
| --- | --- | --- |
| `--oas-bg` | `#0F172A` | `#F8FAFC` |
| `--oas-surface-1` | `#111C2E` | `#FFFFFF` |
| `--oas-surface-2` | `#1B2438` | `#F1F5F9` |
| `--oas-surface-3` | `#232F44` | `#E2E8F0` |
| `--oas-border` | `#1E293B` | `#E2E8F0` |
| `--oas-border-strong` | `#334155` | `#CBD5E1` |
| `--oas-text` | `#F1F5F9` | `#0F172A` |
| `--oas-text-muted` | `#94A3B8` | `#475569` |
| `--oas-text-dim` | `#64748B` | `#64748B`（不变，浅底上仍达标） |
| `--oas-primary` | `#4F46E5` | `#0B6CFF` |
| `--oas-primary-soft` | `#A5B4FC` | `#0B6CFF`（浅底上直接用主色保证文字对比度） |
| `--oas-primary-hover` | `#4338CA` | `#0959D9` |
| `--oas-on-primary` | `#FFFFFF` | `#FFFFFF`（不变） |
| `--oas-success` | `#22C55E` | `#16A34A`（浅底加深一档） |
| `--oas-success-soft` | `#4ADE80` | `#16A34A`（浅底用法处）；终端深色块内继续用 `#4ADE80` |
| `--oas-ring` | `#818CF8` | `#38BDF8` |

阴影 token 由黑色重阴影改为 slate 柔和阴影：

| token | 新值 |
| --- | --- |
| `--oas-shadow-sm` | `0 1px 2px rgba(15,23,42,.06)` |
| `--oas-shadow-md` | `0 8px 24px rgba(15,23,42,.08)` |
| `--oas-shadow-lg` | `0 24px 60px rgba(15,23,42,.12)` |
| `--oas-shadow-primary` | `0 6px 18px rgba(11,108,255,.25)` |

## 配套细节

1. **品牌渐变**（hero 标题 `.brand`、`f-card::before` 顶部渐变线）：`linear-gradient(110deg, #0B6CFF 0%, #0EA5E9 60%, #38BDF8 100%)`
2. **页面顶部光晕**：`radial-gradient(900px 520px at 50% -120px, rgba(11,108,255,.10), transparent 70%)`
3. **导航毛玻璃**：`rgba(255,255,255,.72)`；`scrollbar-color` 换浅色值
4. **终端块保持深色**（`#0F172A` 底），作为浅色页视觉焦点；终端内 `$` 提示符用 `#7EB6FF`，`✓` 成功行保持 `#4ADE80`（深底上亮绿）；终端红点/黄点/绿点 macOS 三色不变
5. **三张特性卡 SVG 示意截图**：由深色仪表板改为浅色仪表板——白/浅灰底、浅灰占位条、`#0B6CFF` 蓝色点缀（折线、高亮块），与卡片浅色底融合
6. **meta / favicon**：`theme-color` → `#F8FAFC`；`color-scheme` → `light`；favicon SVG 的 `#4F46E5`/`#8183C4` → `#0B6CFF`/`#38BDF8`
7. **标签配色**：「首推」标签 → 蓝（`rgba(11,108,255,.10)` 底 + `#0B6CFF` 字）；「零构建」「零构建 · MPA」标签 → 绿（`rgba(22,163,74,.10)` 底 + `#16A34A` 字）；普通特性 tag 保持中性浅灰
8. **其余杂项**：`::selection`、语言切换激活态、ghost CTA hover 边框、eyebrow 胶囊底/边、卡片 hover 阴影等全部从 indigo/深色系换为上述蓝色/浅色系

## 可访问性（WCAG AA，浅底）

- 主文字 `#0F172A` on `#F8FAFC`：≈15:1
- muted `#475569`：≈7:1；dim `#64748B`：≈4.8:1（仅辅助小字）
- 主色按钮白字 on `#0B6CFF`：≈4.6:1
- `focus-visible` 外框 `--oas-ring` + 2px offset 保留

## 验证

- `pnpm site` 聚合构建通过，产物 `site/dist/index.html` 生效
- 浏览器肉眼检查：hero、终端、三张卡片、footer、语言切换中/英两态、窄屏断点（1020px / 560px）
- 对比度按上表达标
