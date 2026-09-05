# 门户首页浅色主题配色改版 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `site/index.html` 从深色 Indigo 配色改为浅色主题 + `#0B6CFF` 蓝色系，布局/文案/JS 零改动。

**Architecture:** 单文件静态页，所有颜色集中在 `:root` token + 少量硬编码色值。改造 = token 重定义 + 硬编码色值逐一替换 + 三张 SVG 示意图按固定映射表换色。终端块例外保持深色。

**Tech Stack:** 纯 HTML/CSS（无构建步骤作用于该文件本身）；验证用 `pnpm site`（聚合构建）+ `rg` 颜色扫描。

**Spec:** `docs/superpowers/specs/2026-09-05-homepage-light-theme-design.md`

## Global Constraints

- 只修改 `site/index.html`，不动 `templates/` 下任何文件
- 不改 HTML 结构、文案、i18n 字典、JS 逻辑、打字机动效
- 不做深色切换 / `prefers-color-scheme` 分支
- 终端块（`.terminal`）及其内部文字色保持深色系（例外色：`#7EB6FF`、`#4ADE80`）
- 代码注释用中文；commit message 用中文、遵循仓库 conventional commits 风格（如 `feat(portal): ...`）
- 每个 Task 结束独立提交

---

### Task 1: 配色 token 与全局样式换色

**Files:**
- Modify: `site/index.html:6-13`（meta / favicon）
- Modify: `site/index.html:35-86`（`:root` token 块）
- Modify: `site/index.html:89-149`（html/body/selection/nav/lang-switch）

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: 后续任务依赖的新 token 值——`--oas-primary: #0B6CFF`、`--oas-primary-soft: #0B6CFF`、`--oas-success-soft: #16A34A`、`--oas-ring: #38BDF8` 等

- [ ] **Step 1: 替换 meta 与 favicon（第 6-13 行）**

`theme-color` 与 `color-scheme`：

```html
<meta name="theme-color" content="#F8FAFC" />
<meta name="color-scheme" content="light" />
```

favicon 的 data URI 中：`stop-color=%22%234F46E5%22` → `stop-color=%22%230B6CFF%22`，`stop-color=%22%238183C4%22` → `stop-color=%22%2338BDF8%22`，`fill=%22%234F46E5%22` → `fill=%22%230B6CFF%22`（共 3 处替换，URL 编码形式 `%23` 开头）。

- [ ] **Step 2: 替换 `:root` 颜色与阴影 token（第 36-52、78-81 行）**

将 `:root` 中颜色 token 整段替换为：

```css
        /* 颜色 token（不写 raw hex） */
        --oas-bg: #F8FAFC;
        --oas-surface-1: #FFFFFF;
        --oas-surface-2: #F1F5F9;
        --oas-surface-3: #E2E8F0;
        --oas-border: #E2E8F0;
        --oas-border-strong: #CBD5E1;
        --oas-text: #0F172A;
        --oas-text-muted: #475569;
        --oas-text-dim: #64748B;
        --oas-primary: #0B6CFF;
        --oas-primary-soft: #0B6CFF;
        --oas-primary-hover: #0959D9;
        --oas-on-primary: #FFFFFF;
        --oas-success: #16A34A;
        --oas-success-soft: #16A34A;
        --oas-ring: #38BDF8;
```

阴影 token（第 78-81 行）替换为：

```css
        --oas-shadow-sm: 0 1px 2px rgba(15,23,42,.06);
        --oas-shadow-md: 0 8px 24px rgba(15,23,42,.08);
        --oas-shadow-lg: 0 24px 60px rgba(15,23,42,.12);
        --oas-shadow-primary: 0 6px 18px rgba(11,108,255,.25);
```

- [ ] **Step 3: 全局元素换色（第 89-149 行）**

- `html` 选择器：`scrollbar-color: var(--oas-border-strong) var(--oas-bg);` 不变（token 已换），无需改
- `body` 的 `background`：`rgba(79,70,229,.16)` → `rgba(11,108,255,.10)`
- `::selection`：`background: rgba(79,70,229,.35)` → `background: rgba(11,108,255,.22)`
- `.nav` 的 `background`：`rgba(15,23,42,.72)` → `rgba(255,255,255,.72)`
- `.nav-link:hover` 的 `background`：`rgba(255,255,255,.04)` → `rgba(15,23,42,.04)`
- `.lang-switch` 的 `background`：`rgba(255,255,255,.04)` → `rgba(15,23,42,.04)`

- [ ] **Step 4: 验证本任务无残留旧色**

Run: `rg -n "79,70,229|129,140,248|4F46E5|8183C4|A5B4FC|4338CA" site/index.html`
Expected: 仍有命中（hero/卡片/标签的硬编码色属 Task 2），但第 6-149 行范围内不应再有命中。逐条核对行号确认残留都在 150 行之后。

- [ ] **Step 5: Commit**

```bash
git add site/index.html
git commit -m "feat(portal): 首页配色 token 与全局样式切换为浅色蓝色系"
```

---

### Task 2: 组件硬编码色换色（hero / 卡片 / 标签 / 终端例外）

**Files:**
- Modify: `site/index.html:150-320`（hero、anchor-strip、CTA、terminal、features、footer 样式块）
- Modify: `site/index.html:456,512,560`（三个标签的内联 style）

**Interfaces:**
- Consumes: Task 1 的新 token（`--oas-primary-soft` 等）
- Produces: `.t-prompt`、`.t-cursor`、`.t-ok` 改用终端专用固定色 `#7EB6FF` / `#4ADE80`（不再引用 token）

- [ ] **Step 1: hero 区换色**

- `.hero-eyebrow`：`background: rgba(79,70,229,.10); border: 1px solid rgba(79,70,229,.32)` → `background: rgba(11,108,255,.07); border: 1px solid rgba(11,108,255,.25)`
- `.hero h1 .brand` 渐变：`linear-gradient(110deg, #7da0ff 0%, #a78bfa 60%, #c084fc 100%)` → `linear-gradient(110deg, #0B6CFF 0%, #0EA5E9 60%, #38BDF8 100%)`

- [ ] **Step 2: 终端块固定深色 + 终端内文字例外色**

- `.terminal` 的 `background: #0A1120` → `background: #0F172A`（保持深色，与边框 token 协调）
- `.terminal-bar` 的 `background: rgba(255,255,255,.02)` **不变**（深底上的微亮）
- `.t-prompt`：`color: var(--oas-primary-soft)` → `color: #7EB6FF`（终端深底专用亮蓝，不引用 token）
- `.t-cursor` 的 `background: var(--oas-primary-soft)` → `background: #7EB6FF`
- `.t-ok`：`color: var(--oas-success-soft)` → `color: #4ADE80`（终端深底专用亮绿）
- macOS 三色圆点 `.dot-r/.dot-y/.dot-g` 不变

- [ ] **Step 3: features / 卡片 / footer 换色**

- `.f-card::before` 渐变：同 hero `.brand`，改为 `linear-gradient(110deg, #0B6CFF 0%, #0EA5E9 60%, #38BDF8 100%)`
- `.f-card:hover` 的 `box-shadow: 0 10px 30px rgba(0,0,0,.35)` → `box-shadow: 0 10px 30px rgba(15,23,42,.10)`
- `.f-feat` 的 `background: rgba(255,255,255,.04)` → `background: var(--oas-surface-2)`
- `.features-head h2` 的 `color: var(--oas-primary-soft)` → `color: var(--oas-text)`（浅底下标题用主文字色，eyebrow 已是主色）

- [ ] **Step 4: 三个标签内联 style 换色（HTML 第 456、512、560 行）**

- 「首推」（456 行）：`style="border:0;background:rgba(79,70,229,.16);color:#A5B4FC"` → `style="border:0;background:rgba(11,108,255,.10);color:#0B6CFF"`
- 「零构建」（512 行）：`style="border:0;background:rgba(34,197,94,.14);color:#4ADE80"` → `style="border:0;background:rgba(22,163,74,.10);color:#16A34A"`
- 「零构建 · MPA」（560 行）：`style="border:0;background:rgba(129,140,248,.14);color:#A5B4FC"` → `style="border:0;background:rgba(22,163,74,.10);color:#16A34A"`

- [ ] **Step 5: 验证旧色清零**

Run: `rg -n "79,70,229|129,140,248|34,197,94|4F46E5|8183C4|A5B4FC|4338CA|7da0ff|a78bfa|c084fc|22C55E" site/index.html`
Expected: 仅 SVG 示意图块（约 406-554 行）内可能残留 `#4F46E5` / `#22C55E` —— 属 Task 3；其余区域必须 0 命中。

- [ ] **Step 6: Commit**

```bash
git add site/index.html
git commit -m "feat(portal): 首页组件硬编码色切换为蓝色系，终端保持深色"
```

---

### Task 3: 三张 SVG 示意截图浅色化

**Files:**
- Modify: `site/index.html:406-554`（三张 `.f-shot` 内的 `<svg>`）

**Interfaces:**
- Consumes: Task 1 的浅色 token 色值
- Produces: 无（最后一个改动任务）

SVG 内颜色按以下 **1:1 映射表** 机械替换（fill / stroke / stop-color 均适用，共三张图、逐张处理）：

| 旧值 | 新值 | 用途 |
| --- | --- | --- |
| `#111C2E` | `#FFFFFF` | 示意图背景渐变起点 |
| `#0A1120` | `#F1F5F9` | 示意图背景渐变终点 / 内嵌面板底 |
| `#0F172A` | `#FFFFFF` | 面板/卡片底 |
| `#1E293B` | `#E2E8F0` | 描边 / 最浅占位条 |
| `#334155` | `#CBD5E1` | 次级占位条 |
| `#475569` | `#94A3B8` | 标题级占位条 |
| `#4F46E5` | `#0B6CFF` | 主色点缀（折线、高亮块、logo 点） |
| `#818CF8` | `#38BDF8` | 次色点缀（第二折线等） |
| `#22C55E` | `#16A34A` | 绿色状态点 |

三张图的 `<defs>` 渐变（id 分别为 `vanilla-bg` / `cdn-bg` / `mpa-bg`）替换后均为：

```html
<linearGradient id="vanilla-bg" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFFFFF"/>
  <stop offset="1" stop-color="#F1F5F9"/>
</linearGradient>
```

（`cdn-bg`、`mpa-bg` 同构，仅 id 不同。）

注意：`.f-shot` 容器本身是 `var(--oas-surface-2)` 浅灰底，SVG 换成白/浅灰后与容器自然融合；`stroke` 属性上的旧色同样按映射表替换。

- [ ] **Step 1: 按映射表替换第一张 SVG（vanilla，约 406-450 行）**
- [ ] **Step 2: 按映射表替换第二张 SVG（cdn，约 471-506 行）**
- [ ] **Step 3: 按映射表替换第三张 SVG（mpa，约 526-554 行）**
- [ ] **Step 4: 全文件旧色扫描清零**

Run: `rg -ni "79,70,229|129,140,248|34,197,94|4F46E5|8183C4|A5B4FC|4338CA|7da0ff|a78bfa|c084fc|22C55E|0A1120|111C2E|1B2438|232F44|818CF8" site/index.html`
Expected: 0 命中（`#0F172A` 保留是合法的：终端块底色 + `--oas-text`）。

- [ ] **Step 5: Commit**

```bash
git add site/index.html
git commit -m "feat(portal): 首页卡片 SVG 示意图浅色化"
```

---

### Task 4: 构建验证与终检

**Files:**
- 无改动（仅验证）；如发现问题回到对应 Task 修复

**Interfaces:**
- Consumes: Task 1-3 的全部改动
- Produces: 可用的 `site/dist/index.html`

- [ ] **Step 1: 聚合构建**

Run: `pnpm site`
Expected: 成功退出（exit 0），`site/dist/index.html` 为最新产物

- [ ] **Step 2: 产物确认新配色生效**

Run: `rg -c "0B6CFF" site/dist/index.html && rg -ni "4F46E5" site/dist/index.html || echo "旧主色已清零"`
Expected: `0B6CFF` 多处命中；旧主色无命中并输出「旧主色已清零」

- [ ] **Step 3: 本地起服务肉眼检查**

Run: `npx serve site/dist -l 4173`（或 `python3 -m http.server 4173 -d site/dist`）

浏览器打开 `http://localhost:4173` 逐项检查：
- hero：渐变标题为蓝→青；eyebrow 胶囊蓝字浅蓝底；两个 CTA 正常
- 终端块仍为深色，`$` 亮蓝、`✓` 亮绿、光标闪烁正常
- 三张卡片：SVG 示意图为浅色仪表板，标签配色正确（首推=蓝、零构建×2=绿）
- 语言切换 中/EN 两态样式正常；窄屏（<1020px、<560px）无异常
- `focus-visible` 蓝色外框可见（Tab 键走一遍）

- [ ] **Step 4: 停掉 brainstorm 可视化服务**

Run: `/Users/zandy/.cache/opencode/packages/superpowers@git+https:/github.com/obra/superpowers.git/node_modules/superpowers/skills/brainstorming/scripts/stop-server.sh /private/var/www/zandy/oas-ui-templates/.superpowers/brainstorm/43009-1788576040`
Expected: 服务停止，无报错
