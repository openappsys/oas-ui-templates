/**
 * CDN 模板版本对齐（fail closed）：把 cdn / cdn-mpa 全部 html 里钉死的 unpkg 版本
 * （@oas-ui/theme@x.y.z、@oas-ui/ui@x.y.z）与两个 i18n.js 里语言包版本
 * （@oas-ui/i18n@x.y.z，必须与 ui 同版，避免「新壳 + 旧语言包」）对齐到目标版本。
 *
 * 校验规则（缺失 / 非法 / 模板变量 / 重复冲突一律 exit 1，check 与写模式同门槛）：
 * - 每个 html：必须同时存在 ≥1 个 theme pin 与 ≥1 个 ui pin，各自版本一致且等于目标版本
 * - 每个 i18n.js：必须恰好一个合法 @oas-ui/i18n pin（完整 semver），版本等于目标版本
 * - pin 边界断言：版本后必须紧跟 / 或引号——`@2.6`、`@2.6.4.1`、`@${VERSION}` 等零匹配即缺失
 *
 * 用法：
 *   node scripts/bump-cdn.mjs                       # 对齐到本地 node_modules 已装的 @oas-ui/ui 版本
 *   node scripts/bump-cdn.mjs 2.5.7                 # 对齐到指定版本
 *   node scripts/bump-cdn.mjs --check               # 只报告不一致，不改动（CI 可用）
 *   node scripts/bump-cdn.mjs --root <dir> --check 2.6.4   # 扫描指定根（自测用）
 *   node scripts/bump-cdn.mjs --self-test           # fixture 自测（stale/missing/malformed/templated/conflict）
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// html：theme/ui 两个 pin；js：i18n 语言包 pin（动态 import 的真实文件路径，与 ui 同 release line）
const htmlDirs = ['templates/admin-pro/cdn', 'templates/admin-pro/cdn-mpa']
const pinnedJsFiles = ['templates/admin-pro/cdn/i18n.js', 'templates/admin-pro/cdn-mpa/js/i18n.js']

/** pin 提取（带边界断言：版本后必须紧跟 / 或引号，拒绝 2.6 / 2.6.4.1 等非法形态） */
function pinRegex(kind) {
  if (kind === 'i18n') return /@oas-ui\/i18n@(\d+\.\d+\.\d+)(?=\/|['"`])/g
  if (kind === 'theme') return /@oas-ui\/theme@(\d+\.\d+\.\d+)(?=\/|['"`])/g
  if (kind === 'ui') return /@oas-ui\/ui@(\d+\.\d+\.\d+)(?=\/|['"`])/g
  return /@oas-ui\/(?:theme|ui)@(\d+\.\d+\.\d+)(?=\/|['"`])/g
}

function collectPins(content, kind) {
  const out = []
  for (const m of content.matchAll(pinRegex(kind))) out.push(m[1])
  return out
}

function distinctVersions(versions) {
  return [...new Set(versions)]
}

function rewritePin(content, kind, target) {
  return content.replace(
    pinRegex(kind),
    (whole, ver) => whole.slice(0, whole.length - ver.length) + target,
  )
}

/** html 校验与改写计划：theme/ui 双 pin 在场、各自版本一致；结构性问题进 problems（fail closed） */
export function planHtmlPins(content, target) {
  const problems = []
  const theme = collectPins(content, 'theme')
  const ui = collectPins(content, 'ui')
  if (theme.length === 0)
    problems.push('缺少 @oas-ui/theme@x.y.z pin（缺失 / 非完整 semver / 模板变量）')
  else if (distinctVersions(theme).length > 1)
    problems.push(`theme pin 版本冲突：${distinctVersions(theme).join(' vs ')}`)
  if (ui.length === 0) problems.push('缺少 @oas-ui/ui@x.y.z pin（缺失 / 非完整 semver / 模板变量）')
  else if (distinctVersions(ui).length > 1)
    problems.push(`ui pin 版本冲突：${distinctVersions(ui).join(' vs ')}`)
  const stale = theme.some((v) => v !== target) || ui.some((v) => v !== target)
  return {
    problems,
    stale,
    next:
      stale && problems.length === 0
        ? rewritePin(rewritePin(content, 'theme', target), 'ui', target)
        : null,
  }
}

/** i18n.js 校验与改写计划：恰好一个合法 pin 且等于目标版本 */
export function planI18nPins(content, target) {
  const problems = []
  const pins = collectPins(content, 'i18n')
  if (pins.length === 0)
    problems.push('缺少 @oas-ui/i18n@x.y.z pin（缺失 / 非完整 semver / 模板变量）')
  else if (pins.length > 1)
    problems.push(
      `@oas-ui/i18n pin 必须恰好一个，实为 ${pins.length} 处${
        distinctVersions(pins).length > 1
          ? `（版本冲突：${distinctVersions(pins).join(' vs ')}）`
          : ''
      }`,
    )
  const stale = pins.length >= 1 && pins.some((v) => v !== target)
  return {
    problems,
    stale,
    next: stale && problems.length === 0 ? rewritePin(content, 'i18n', target) : null,
  }
}

function installedVersion(root) {
  for (const tpl of ['react', 'vue', 'svelte', 'vanilla-html']) {
    const p = join(root, 'templates/admin-pro', tpl, 'node_modules/@oas-ui/ui/package.json')
    try {
      return JSON.parse(readFileSync(p, 'utf8')).version
    } catch {
      /* 下一个模板 */
    }
  }
  throw new Error('未找到已安装的 @oas-ui/ui——先 pnpm install，或显式传版本号')
}

function run(root, target, checkOnly) {
  let files = 0
  let changed = 0
  const stale = []
  const invalid = []

  function scanFile(path, kind) {
    files++
    const src = readFileSync(path, 'utf8')
    const plan = kind === 'i18n' ? planI18nPins(src, target) : planHtmlPins(src, target)
    if (plan.problems.length > 0) {
      invalid.push({ path: path.replaceAll('\\', '/'), problems: plan.problems })
      return
    }
    if (plan.stale) {
      if (checkOnly) stale.push(path.replaceAll('\\', '/'))
      else {
        writeFileSync(path, plan.next)
        changed++
        console.log(`  ${path.replaceAll('\\', '/')}`)
      }
    }
  }

  for (const dir of htmlDirs) {
    const abs = join(root, dir)
    if (!existsSync(abs)) continue
    for (const name of readdirSync(abs)) {
      if (!name.endsWith('.html')) continue
      scanFile(join(abs, name), 'html')
    }
  }
  for (const rel of pinnedJsFiles) {
    const abs = join(root, rel)
    if (!existsSync(abs)) continue
    scanFile(abs, 'i18n')
  }

  if (invalid.length > 0) {
    console.error('以下文件 pin 结构非法（缺失/非法/模板变量/重复冲突），fail closed：')
    for (const item of invalid) {
      for (const p of item.problems) console.error(`  ${item.path} → ${p}`)
    }
    process.exit(1)
  }
  if (checkOnly) {
    if (stale.length > 0) {
      console.error(`以下文件版本未对齐到 ${target}（theme/ui/i18n 三个 pin 同版）：`)
      for (const s of stale) console.error(`  ${s}`)
      process.exit(1)
    }
    console.log(`check ok：${files} 个文件（html theme/ui + i18n.js 语言包）均已对齐 @${target}`)
  } else {
    console.log(`done：${changed}/${files} 个文件 → @${target}`)
  }
}

// —— 自测：fixture 覆盖 stale / missing / malformed / templated / conflict（可重复，不碰真实仓库） ——
const OK = '2.6.4'
function fixtureHtml(theme, ui) {
  return `<!doctype html><html><head>
<link rel="stylesheet" href="https://unpkg.com/@oas-ui/theme@${theme}/index.css" />
<script src="https://unpkg.com/@oas-ui/ui@${ui}/dist/cdn.js"></script>
</head><body></body></html>`
}
function fixtureI18n(i18n) {
  return `const EN_PACK_URL = 'https://unpkg.com/@oas-ui/i18n@${i18n}/dist/en.js'\nexport {}\n`
}

function selfTest() {
  const script = join(import.meta.dirname ?? '.', 'bump-cdn.mjs')
  const cases = [
    {
      name: 'html 全部对齐 → check ok',
      files: { html: fixtureHtml(OK, OK), i18n: fixtureI18n(OK) },
      check: 0,
      write: 0,
    },
    {
      name: 'html ui pin stale → check exit 1，写模式改回',
      files: { html: fixtureHtml(OK, '2.5.9'), i18n: fixtureI18n(OK) },
      check: 1,
      write: 0,
      expectHtml: fixtureHtml(OK, OK),
    },
    {
      name: 'html i18n pin stale → check exit 1，写模式改回',
      files: { html: fixtureHtml(OK, OK), i18n: fixtureI18n('2.5.9') },
      check: 1,
      write: 0,
      expectI18n: fixtureI18n(OK),
    },
    {
      name: 'html 缺 ui pin → fail closed（check 与写模式都 exit 1）',
      files: { html: fixtureHtml(OK, null), i18n: fixtureI18n(OK) },
      check: 1,
      write: 1,
    },
    {
      name: 'html 缺 theme pin → fail closed',
      files: { html: fixtureHtml(null, OK), i18n: fixtureI18n(OK) },
      check: 1,
      write: 1,
    },
    {
      name: 'html ui pin 模板变量（零匹配）→ fail closed',
      files: { html: fixtureHtml(OK, '$' + '{UI_VERSION}'), i18n: fixtureI18n(OK) },
      check: 1,
      write: 1,
    },
    {
      name: 'html theme pin 版本冲突 → fail closed',
      check: 1,
      write: 1,
      files: { i18n: fixtureI18n(OK) },
      raw: `<!doctype html><html><head>
<link rel="stylesheet" href="https://unpkg.com/@oas-ui/theme@2.6.4/index.css" />
<link rel="stylesheet" href="https://unpkg.com/@oas-ui/theme@2.5.9/skins.css" />
<script src="https://unpkg.com/@oas-ui/ui@2.6.4/dist/cdn.js"></script>
</head><body></body></html>`,
    },
    {
      name: 'i18n 缺 pin → fail closed',
      files: { html: fixtureHtml(OK, OK), i18n: "const U = 'https://unpkg.com/x.js'\n" },
      check: 1,
      write: 1,
    },
    {
      name: 'i18n pin 模板变量（零匹配）→ fail closed',
      files: {
        html: fixtureHtml(OK, OK),
        i18n: "const U = 'https://unpkg.com/@oas-ui/i18n@' + '$' + '{COMPONENT_VERSION}/dist/en.js'\n",
      },
      check: 1,
      write: 1,
    },
    {
      name: 'i18n pin 非完整 semver（malformed @2.6）→ fail closed',
      files: {
        html: fixtureHtml(OK, OK),
        i18n: "const U = 'https://unpkg.com/@oas-ui/i18n@2.6/dist/en.js'\n",
      },
      check: 1,
      write: 1,
    },
    {
      name: 'i18n pin 重复且冲突 → fail closed',
      files: {
        html: fixtureHtml(OK, OK),
        i18n: "const A = 'https://unpkg.com/@oas-ui/i18n@2.6.4/dist/en.js'\nconst B = 'https://unpkg.com/@oas-ui/i18n@2.5.9/dist/en.js'\n",
      },
      check: 1,
      write: 1,
    },
    {
      name: 'i18n pin 重复同版（必须恰好一个）→ fail closed',
      files: {
        html: fixtureHtml(OK, OK),
        i18n: "const A = 'https://unpkg.com/@oas-ui/i18n@2.6.4/dist/en.js'\nconst B = 'https://unpkg.com/@oas-ui/i18n@2.6.4/dist/en.js'\n",
      },
      check: 1,
      write: 1,
    },
  ]

  let failed = 0
  const tmpBase = join(import.meta.dirname ?? '.', '.bump-selftest-tmp')
  rmSync(tmpBase, { recursive: true, force: true })
  mkdirSync(tmpBase, { recursive: true })
  const keepTmp = process.env.BUMP_SELFTEST_KEEP === '1'
  for (const [i, c] of cases.entries()) {
    const root = join(tmpBase, `case-${i}`)
    const htmlDir = join(root, 'templates/admin-pro/cdn')
    const mpaDir = join(root, 'templates/admin-pro/cdn-mpa')
    mkdirSync(htmlDir, { recursive: true })
    mkdirSync(mpaDir, { recursive: true })
    writeFileSync(join(htmlDir, 'index.html'), c.raw ?? c.files.html)
    writeFileSync(join(root, 'templates/admin-pro/cdn/i18n.js'), c.files.i18n ?? fixtureI18n(OK))
    // mpa 占位（恒为对齐态）：CLI 会扫描两套模板，占位避免 ENOENT 且不干扰断言
    writeFileSync(join(mpaDir, 'index.html'), fixtureHtml(OK, OK))
    mkdirSync(join(mpaDir, 'js'), { recursive: true })
    writeFileSync(join(mpaDir, 'js/i18n.js'), fixtureI18n(OK))
    const check = spawnSync(process.execPath, [script, '--check', '--root', root, OK], {
      encoding: 'utf8',
    })
    const write = spawnSync(process.execPath, [script, '--root', root, OK], { encoding: 'utf8' })
    const problems = []
    if (check.status !== c.check)
      problems.push(`check exit ${check.status} ≠ ${c.check}（${String(check.stderr)}）`)
    if (write.status !== c.write)
      problems.push(`write exit ${write.status} ≠ ${c.write}（${String(write.stderr)}）`)
    const htmlAfter = readFileSync(join(htmlDir, 'index.html'), 'utf8')
    if (c.expectHtml !== undefined && htmlAfter !== c.expectHtml) problems.push('html 未按预期改写')
    if (c.expectI18n !== undefined) {
      const i18nAfter = readFileSync(join(root, 'templates/admin-pro/cdn/i18n.js'), 'utf8')
      if (i18nAfter !== c.expectI18n) problems.push('i18n.js 未按预期改写')
    }
    if (problems.length > 0) {
      failed++
      console.error(`✗ [${i + 1}/${cases.length}] ${c.name}`)
      for (const p of problems) console.error(`    ${p}`)
    } else {
      console.log(`✓ [${i + 1}/${cases.length}] ${c.name}`)
    }
  }
  if (!keepTmp) rmSync(tmpBase, { recursive: true, force: true })
  else console.log(`selftest tmp kept: ${tmpBase}`)
  if (failed > 0) {
    console.error(`bump-cdn self-test：${failed}/${cases.length} 失败`)
    process.exit(1)
  }
  console.log(`bump-cdn self-test：${cases.length}/${cases.length} 通过`)
}

// —— CLI 入口 ——
const argv = process.argv.slice(2)
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href || argv.includes('--self-test')) {
  if (argv.includes('--self-test')) {
    selfTest()
  } else {
    const rootIdx = argv.indexOf('--root')
    const root = rootIdx !== -1 ? argv[rootIdx + 1] : process.cwd()
    const target =
      argv.find((a, i) => !a.startsWith('--') && i !== rootIdx && i !== rootIdx + 1) ??
      installedVersion(process.cwd())
    if (!/^\d+\.\d+\.\d+$/.test(target)) {
      console.error(`非法版本号：${target}`)
      process.exit(1)
    }
    run(root, target, argv.includes('--check'))
  }
}
