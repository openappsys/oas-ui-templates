import { writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

/**
 * a11y 审计（e2e）：结构化检查 + 报告数据产出。
 * 不引入 axe 等依赖——用 ariaSnapshot 取可访问名（Playwright 已实现 accname，且能穿 shadow DOM/slot），
 * 用页面内 getComputedStyle 取真实颜色算 WCAG 对比度（var() 已在计算值里解析）。
 */

interface ContrastFinding {
  view: string
  theme: string
  fg: string
  bg: string
  ratio: number
  need: number
  size: number
  bold: boolean
  sample: string
  /** 元素路径（tag.class < 父 < 祖父）：定位修复点，也是遗留项放行规则的匹配依据 */
  path: string
  count: number
  disabled: boolean
}

interface ViewAudit {
  view: string
  theme: string
  landmarks: Record<string, number>
  h1: { count: number; text: string }
  htmlLang: string | null
  unnamed: { role: string; line: string }[]
  imgNoAlt: number
  tables: { count: number; th: number; caption: number }[]
  contrastChecked: number
  contrastFail: ContrastFinding[]
  contrastUnknown: number
}

/** 页面内审计：对比度 + 结构。必须自包含（evaluate 序列化到浏览器执行） */
async function auditDom(page: Page): Promise<{
  checked: number
  unknown: number
  fails: Omit<ContrastFinding, 'view' | 'theme'>[]
}> {
  return page.evaluate(() => {
    type Rgba = { r: number; g: number; b: number; a: number }
    const parse = (c: string): Rgba => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return { r: 0, g: 0, b: 0, a: 0 }
      const p = m[1]
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number)
      return { r: p[0] ?? 0, g: p[1] ?? 0, b: p[2] ?? 0, a: p[3] === undefined ? 1 : p[3] }
    }
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      // 标准 source-over：颜色按 alpha 预乘后归一，避免半透明层被当成不透明
      const a = top.a + bottom.a * (1 - top.a)
      if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 }
      return {
        r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
        g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
        b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
        a,
      }
    }
    const lum = (c: Rgba): number => {
      const f = (v: number): number => {
        const s = v / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const ratio = (a: Rgba, b: Rgba): number => {
      const la = lum(a)
      const lb = lum(b)
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
    }

    // 扁平树父节点：跨 shadow 边界时经 slot/host 继续向上，才能拿到真实的绘制背景
    const flatParent = (node: Node): Node | null => {
      const el = node as Element & { assignedSlot?: HTMLSlotElement | null }
      if (el.assignedSlot) return el.assignedSlot
      const p = node.parentNode
      if (!p) return null
      if (p.nodeType === Node.DOCUMENT_NODE) return null
      if (p.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return (p as ShadowRoot).host ?? null
      return p
    }

    const bgOf = (el: Element): { color: Rgba | null; hasImage: boolean } => {
      let node: Node | null = el
      let acc: Rgba | null = null
      let depth = 0
      let hasImage = false
      while (node && depth < 60) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const e = node as Element
          const cs = getComputedStyle(e)
          if (cs.backgroundImage !== 'none') hasImage = true
          const c = parse(cs.backgroundColor)
          acc = acc ? over(acc, c) : c
          if (acc.a >= 0.999) return { color: acc, hasImage }
        }
        node = flatParent(node)
        depth++
      }
      // 到顶仍透明：落到画布白/黑（html 背景已含在循环里，这里只兜底）
      return { color: acc ? over(acc, { r: 255, g: 255, b: 255, a: 1 }) : null, hasImage }
    }

    const isHidden = (el: Element): boolean => {
      let node: Node | null = el
      let depth = 0
      while (node && depth < 40) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const e = node as Element
          const cs = getComputedStyle(e)
          if (cs.display === 'none' || cs.visibility === 'hidden') return true
          if (Number(cs.opacity) < 0.1) return true
          if (e.getAttribute('aria-hidden') === 'true') return true
          if (e.hasAttribute('hidden')) return true
        }
        node = flatParent(node)
        depth++
      }
      return false
    }

    const groups = new Map<
      string,
      {
        fg: string
        bg: string
        ratio: number
        need: number
        size: number
        bold: boolean
        sample: string
        path: string
        count: number
        disabled: boolean
      }
    >()
    let checked = 0
    let unknown = 0

    const visit = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
        const parent = flatParent(node)
        if (!text || !parent || parent.nodeType !== Node.ELEMENT_NODE) return
        const el = parent as Element
        if (el.closest('script,style,noscript')) return
        if (isHidden(el)) return
        const rect = el.getBoundingClientRect()
        if (rect.width < 2 || rect.height < 2) return
        const cs = getComputedStyle(el)
        if (cs.backgroundClip === 'text') {
          unknown++
          return
        }
        const fg = parse(cs.color)
        if (fg.a < 0.05) return
        const bg = bgOf(el)
        if (!bg.color || bg.hasImage) {
          unknown++
          return
        }
        const color = fg.a >= 0.999 ? fg : over(fg, bg.color)
        const size = Number.parseFloat(cs.fontSize)
        const weight = Number(cs.fontWeight) || 400
        const bold = weight >= 700
        const large = size >= 24 || (size >= 18.66 && bold)
        const need = large ? 3 : 4.5
        const r = ratio(color, bg.color)
        checked++
        const disabled = el.closest('[disabled],[aria-disabled="true"],:disabled') !== null
        const key = `${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)}|${Math.round(
          bg.color.r,
        )},${Math.round(bg.color.g)},${Math.round(bg.color.b)}|${Math.round(size)}|${bold}|${disabled}`
        const found = groups.get(key)
        if (found) {
          found.count++
        } else {
          const cls = (e: Element): string =>
            `${e.tagName.toLowerCase()}${[...e.classList].map((c) => `.${c}`).join('')}`
          const p1 = flatParent(el)
          const p2 = p1 && p1.nodeType === Node.ELEMENT_NODE ? flatParent(p1) : null
          groups.set(key, {
            fg: `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)})`,
            bg: `rgb(${Math.round(bg.color.r)} ${Math.round(bg.color.g)} ${Math.round(bg.color.b)})`,
            ratio: Math.round(r * 100) / 100,
            need,
            size: Math.round(size * 10) / 10,
            bold,
            sample: text.slice(0, 40),
            path: [cls(el)]
              .concat(p1 && p1.nodeType === 1 ? [cls(p1 as Element)] : [])
              .concat(p2 && p2.nodeType === 1 ? [cls(p2 as Element)] : [])
              .join(' < '),
            count: 1,
            disabled,
          })
        }
        return
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element & { shadowRoot: ShadowRoot | null }
        // <slot> 的内容按分配节点可见（不在普通子节点里）
        if (el.tagName === 'SLOT') {
          const slot = el as unknown as HTMLSlotElement
          for (const n of slot.assignedNodes({ flatten: true })) visit(n)
          return
        }
        if (el.shadowRoot) {
          for (const n of Array.from(el.shadowRoot.childNodes)) visit(n)
        }
      }
      for (const child of Array.from(node.childNodes)) visit(child)
    }

    visit(document.body)

    const fails = [...groups.values()]
      .filter((g) => !g.disabled && g.ratio < g.need)
      .sort((a, b) => a.ratio - b.ratio)
    return { checked, unknown, fails }
  })
}

/** ariaSnapshot 里没有可访问名的交互节点（Playwright 的 accname 实现，穿 shadow/slot） */
async function snapshotInfo(page: Page): Promise<{
  unnamed: { role: string; line: string }[]
  landmarks: Record<string, number>
  h1: string[]
}> {
  const snap = await page.locator('body').ariaSnapshot()
  const named =
    /button|link|textbox|combobox|checkbox|radio|switch|tab|menuitem|searchbox|slider|spinbutton|dialog|alertdialog/
  const landmarks: Record<string, number> = {}
  const unnamed: { role: string; line: string }[] = []
  const h1: string[] = []
  for (const raw of snap.split('\n')) {
    const line = raw.trim()
    const m = line.match(/^- ([a-z]+)(:|$)/) ?? line.match(/^- ([a-z]+) "/)
    if (!m) continue
    const role = m[1]
    if (
      ['banner', 'main', 'navigation', 'complementary', 'region', 'contentinfo', 'search'].includes(
        role,
      )
    ) {
      landmarks[role] = (landmarks[role] ?? 0) + 1
    }
    if (role === 'heading' && line.includes('[level=1]')) h1.push(line)
    if (!named.test(role)) continue
    if (new RegExp(`^- ${role}(:|$)`).test(line)) unnamed.push({ role, line })
  }
  return { unnamed, landmarks, h1 }
}

async function structure(page: Page) {
  return page.evaluate(() => {
    const q = (sel: string): number => document.querySelectorAll(sel).length
    const tables = [...document.querySelectorAll('table')].map((t) => ({
      count: 1,
      th: t.querySelectorAll('th').length,
      caption: t.querySelectorAll('caption').length,
    }))
    return {
      htmlLang: document.documentElement.getAttribute('lang'),
      imgNoAlt: q('img:not([alt])'),
      tables,
    }
  })
}

async function auditView(page: Page, view: string, theme: string): Promise<ViewAudit> {
  const dom = await auditDom(page)
  const st = await structure(page)
  const snap = await snapshotInfo(page)
  return {
    view,
    theme,
    landmarks: snap.landmarks,
    h1: { count: snap.h1.length, text: snap.h1.join(' | ') },
    htmlLang: st.htmlLang,
    unnamed: snap.unnamed,
    imgNoAlt: st.imgNoAlt,
    tables: st.tables,
    contrastChecked: dom.checked,
    contrastFail: dom.fails.map((f) => ({ ...f, view, theme })),
    contrastUnknown: dom.unknown,
  }
}

const E2E_SEED_SIZE = 5_000

async function openApp(page: Page) {
  await page.addInitScript(
    (n) => localStorage.setItem('oas-pm-seed-size', String(n)),
    E2E_SEED_SIZE,
  )
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), { timeout: 180_000 })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

const setView = (page: Page, v: string) =>
  page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & { value: string }
    el.value = view
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)

/** 主题用 data-theme 属性（上游 theme 包的约定），切换后等一帧让变量生效 */
async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((want) => {
    if (want === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
  }, theme)
  await page.waitForTimeout(150)
}

const results: ViewAudit[] = []
test.afterAll(() => {
  const out = process.env.A11Y_OUT
  if (out) writeFileSync(out, JSON.stringify(results, null, 1))
})

/**
 * 组件内部（shadow DOM）产生的已知遗留：宿主改不了，需要上游改，审计里放行但不隐藏——
 * 每一条都在 docs/a11y-audit.md 的遗留项里列明。
 *  - `tablist`：oas-tabs 的 tablist 在 shadow 内，宿主 aria-label 不转发
 *  - `table`：oas-table 的 <table> 没有 caption/aria-label 通道
 *  - `radiogroup`：oas-segmented 的 radiogroup 在 shadow 内，同样不转发宿主 aria-label
 */
const KNOWN_UNNAMED = new Set(['tablist', 'table', 'radiogroup'])

function assertAudit(view: ViewAudit) {
  const where = `${view.view}/${view.theme}`
  expect(
    view.contrastFail.map((f) => `${f.ratio} ${f.path} ${f.sample}`),
    `contrast ${where}`,
  ).toEqual([])
  const unnamed = view.unnamed.filter((u) => !KNOWN_UNNAMED.has(u.role))
  expect(
    unnamed.map((u) => u.line),
    `unnamed ${where}`,
  ).toEqual([])
  // 主 landmark：每个页面至少一个 main；工作台还要有 banner（顶栏）+ navigation（侧栏）
  expect(view.landmarks.main ?? 0, `main ${where}`).toBeGreaterThanOrEqual(1)
  // 一级标题：每个主视图都有（view 级 h1，只读屏可见也算）
  expect(view.h1.count, `h1 ${where}`).toBe(1)
  expect(view.htmlLang, `lang ${where}`).toMatch(/^(zh-CN|en)$/)
  expect(view.imgNoAlt, `img alt ${where}`).toBe(0)
}

async function auditBothThemes(page: Page, view: string) {
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme)
    const audit = await auditView(page, view, theme)
    results.push(audit)
    assertAudit(audit)
  }
  await setTheme(page, 'light')
}

test('A1 列表视图', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await auditBothThemes(page, 'list')
})

test('A2 看板视图', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeVisible({ timeout: 20_000 })
  await auditBothThemes(page, 'board')
})

test('A3 甘特/时间线视图', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await setView(page, 'timeline')
  await expect(page.getByTestId('gantt')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(600)
  await auditBothThemes(page, 'timeline')
})

test('A4 资源视图', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await setView(page, 'resource')
  await expect(page.getByTestId('resource-view')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(600)
  await auditBothThemes(page, 'resource')
})

test('A5 日程视图', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await setView(page, 'schedule')
  await expect(page.getByTestId('schedule-view')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(800)
  await auditBothThemes(page, 'schedule')
})

test('A6 仪表盘', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await setView(page, 'dashboard')
  await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(800)
  await auditBothThemes(page, 'dashboard')
})

test('A7 管理台', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(500)
  await auditBothThemes(page, 'admin')
})

test('A7b 权限页：角色 / 项目访问 / 审计', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-permissions').click()
  await expect(page.getByTestId('admin-custom-roles')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(400)
  await auditBothThemes(page, 'permissions-roles')

  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /项目访问|Project access/ })
    .click()
  await page.waitForTimeout(400)
  await auditBothThemes(page, 'permissions-access')

  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /审计|Audit/ })
    .click()
  await page.waitForTimeout(400)
  await auditBothThemes(page, 'permissions-audit')
})

test('A8 详情抽屉', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await page
    .locator('.issue-row')
    .first()
    .evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=detail-drawer]') as { opened?: boolean })
              ?.opened ?? false,
        ),
      { timeout: 15_000 },
    )
    .toBe(true)
  await page.waitForTimeout(500)
  await auditBothThemes(page, 'drawer')
})

test('A9 登录页（API 模式）', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    localStorage.setItem('oas-pm-data', 'api')
    localStorage.removeItem('oas-pm-token')
  })
  await page.goto('/')
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 })
  await auditBothThemes(page, 'login')
})

/** 当前聚焦元素：穿 shadow 取真正的焦点元素，并回报它自己与宿主的可见焦点指示 */
async function focusInfo(page: Page) {
  return page.evaluate(() => {
    const deepActive = (): Element | null => {
      let el = document.activeElement
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
      return el as Element | null
    }
    const el = deepActive()
    if (!el) return null
    const visible = (target: Element | null): boolean => {
      if (!target) return false
      const cs = getComputedStyle(target)
      const outline = cs.outlineStyle !== 'none' && Number.parseFloat(cs.outlineWidth || '0') > 0
      const shadow = cs.boxShadow !== 'none'
      const ring = cs.getPropertyValue('--oas-focus-ring') !== ''
      return outline || shadow || ring
    }
    const label =
      el.getAttribute('aria-label') ??
      el.getAttribute('placeholder') ??
      (el.textContent ?? '').trim().slice(0, 20)
    return {
      tag: el.tagName.toLowerCase(),
      label,
      self: visible(el),
      host: visible(
        el.getRootNode() instanceof ShadowRoot ? (el.getRootNode() as ShadowRoot).host : null,
      ),
    }
  })
}

test('A10 焦点：登录页 Tab 顺序与 focus-visible', async ({ page }) => {
  test.setTimeout(120_000)
  // 登录页（API 模式）：Tab 从品牌区走到表单控件，每个落点都要有可见焦点指示
  await page.addInitScript(() => {
    localStorage.setItem('oas-pm-data', 'api')
    localStorage.removeItem('oas-pm-token')
  })
  await page.goto('/')
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 20_000 })
  const loginTrace: Array<{ tag: string; label: string; self: boolean; host: boolean }> = []
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const info = await focusInfo(page)
    if (info) loginTrace.push(info)
  }
  // 焦点不落空、且每个落点都有可见指示（自身或 shadow 宿主的焦点环）
  expect(loginTrace.length, 'login tab stops').toBe(8)
  for (const stop of loginTrace) {
    expect(stop.self || stop.host, `focus visible on ${stop.tag}:${stop.label}`).toBe(true)
  }
  // 表单控件确实被 Tab 到（登录可用键盘完成）
  expect(loginTrace.some((s) => s.tag === 'input')).toBe(true)
})

test('A10b 焦点：列表 Tab 顺序 + 键盘开抽屉后焦点进入抽屉', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  // 中性落点：不要点 app-bar 中心（顶栏中部现在是视图切换，会切走列表）
  await page.locator('.tb-brand').click()
  const mainTrace: string[] = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const info = await focusInfo(page)
    if (info) mainTrace.push(`${info.tag}:${info.label}`)
    // 逐站复核可见焦点（键盘用户必须看得到自己在哪）
    if (info) expect(info.self || info.host, `focus visible: ${info.tag}`).toBe(true)
  }
  // 不卡死：12 次 Tab 至少落在 6 个不同元素上
  expect(new Set(mainTrace).size).toBeGreaterThanOrEqual(6)

  await page.locator('.issue-row').first().focus()
  await page.keyboard.press('Enter')
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=detail-drawer]') as { opened?: boolean })
              ?.opened ?? false,
        ),
      { timeout: 15_000 },
    )
    .toBe(true)
  // 抽屉打开后焦点在抽屉内（不是留在行上）
  const inDrawer = await page.evaluate(() => {
    const drawer = document.querySelector('[data-testid=detail-drawer]')
    if (!drawer) return false
    let el: Element | null = document.activeElement
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
    let deep: Element | null = el
    while (deep) {
      if (deep === drawer) return true
      const root = deep.getRootNode()
      deep = root instanceof ShadowRoot ? (root.host as Element) : deep.parentElement
    }
    return false
  })
  expect(inDrawer).toBe(true)
})

test('A11 动效：prefers-reduced-motion 下的动画/过渡', async ({ page }) => {
  test.setTimeout(240_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openApp(page)
  const moving = await page.evaluate(() => {
    type Hit = { path: string; animation: string; transition: string; count: number }
    const found = new Map<string, Hit>()
    const visit = (root: Node): void => {
      for (const child of Array.from(root.childNodes)) {
        if (child.nodeType !== Node.ELEMENT_NODE) continue
        const el = child as Element
        const cs = getComputedStyle(el)
        const anim = cs.animationName !== 'none' && cs.animationDuration !== '0s'
        const trans = Number.parseFloat(cs.transitionDuration) > 0.02
        if (anim || trans) {
          const key = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`
          const hit = found.get(key)
          if (hit) hit.count++
          else
            found.set(key, {
              path: key,
              animation: anim ? `${cs.animationName} ${cs.animationDuration}` : '',
              transition: trans ? cs.transitionDuration : '',
              count: 1,
            })
        }
        if (el.shadowRoot) visit(el.shadowRoot)
      }
    }
    visit(document.body)
    return [...found.values()]
  })
  // 宿主侧样式表没有动画（app.css 零 animation/transition），组件在 reduce 下也没有残留动画；
  // 一旦有人加了动效却没做降级，这里会失败——降级是硬要求，不作为遗留项放过。
  console.log(`A11 reduced-motion animated nodes: ${JSON.stringify(moving)}`)
  expect(moving).toEqual([])
})
