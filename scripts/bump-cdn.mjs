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

const FULL_SEMVER = /^\d+\.\d+\.\d+$/

/**
 * 结构对账：提取某包的「全部版本声明形态」——@oas-ui/<pkg>@ 后到边界（/ 引号 空白）前的整段。
 * 非法（@2.6）、模板变量（@${VAR}）、多余段（@2.6.4.1）都会被原样捕获，交 auditDeclarations 拒绝；
 * 不带 @ 的子路径/文字引用（如注释里的 @oas-ui/i18n/en、prose 里的 @oas-ui/ui@ 同版）不产生声明，不误伤。
 */
function collectDeclarations(content, pkg) {
  const re = new RegExp(`@oas-ui\\/${pkg}@([^\\/'"\`\\s]*)`, 'g')
  const out = []
  for (const m of content.matchAll(re)) out.push(m[1])
  return out
}

function distinctVersions(versions) {
  return [...new Set(versions)]
}

/** 逐处审计：非法/模板变量声明、数量不符（i18n 恰好一个）、版本冲突全部进 problems（fail closed） */
function auditDeclarations(decls, label, target, exactlyOne) {
  const problems = []
  if (decls.length === 0) {
    problems.push(
      `${label} 版本声明缺失（零处 @oas-ui/…@ 形态——缺失 / 非完整 semver / 模板变量均无法对账）`,
    )
    return { problems, stale: false }
  }
  const invalid = decls.filter((v) => !FULL_SEMVER.test(v))
  if (invalid.length > 0) problems.push(`${label} 非法/模板变量版本声明：${invalid.join('、')}`)
  const valid = decls.filter((v) => FULL_SEMVER.test(v))
  if (exactlyOne && valid.length > 1)
    problems.push(
      `${label} pin 必须恰好一个合法声明，实为 ${valid.length} 处${
        distinctVersions(decls).length > 1
          ? `（版本冲突：${distinctVersions(decls).join(' vs ')}）`
          : ''
      }`,
    )
  if (!exactlyOne && distinctVersions(valid).length > 1)
    problems.push(`${label} pin 版本冲突：${distinctVersions(valid).join(' vs ')}`)
  const stale = valid.length > 0 && valid.some((v) => v !== target)
  return { problems, stale }
}

function rewriteDeclarations(content, pkg, target) {
  const re = new RegExp(`@oas-ui\\/${pkg}@\\d+\\.\\d+\\.\\d+(?=\\/|['"\`]|\\s|$)`, 'g')
  return content.replace(re, (whole) => whole.slice(0, whole.length - target.length) + target)
}

function rewritePin(content, kind, target) {
  if (kind === 'i18n') return rewriteDeclarations(content, 'i18n', target)
  return rewriteDeclarations(rewriteDeclarations(content, 'theme', target), 'ui', target)
}

/** html 校验与改写计划：theme/ui 双 pin 结构对账（所有声明形态），各自版本一致；问题 fail closed */
export function planHtmlPins(content, target) {
  const problems = []
  const themeAudit = auditDeclarations(
    collectDeclarations(content, 'theme'),
    '@oas-ui/theme',
    target,
    false,
  )
  const uiAudit = auditDeclarations(collectDeclarations(content, 'ui'), '@oas-ui/ui', target, false)
  problems.push(...themeAudit.problems, ...uiAudit.problems)
  const stale = themeAudit.stale || uiAudit.stale
  return {
    problems,
    stale,
    next: stale && problems.length === 0 ? rewritePin(content, 'html', target) : null,
  }
}

/** i18n.js 校验与改写计划：恰好一个合法 pin（结构对账所有声明形态）且等于目标版本 */
export function planI18nPins(content, target) {
  const audit = auditDeclarations(
    collectDeclarations(content, 'i18n'),
    '@oas-ui/i18n',
    target,
    true,
  )
  return {
    problems: audit.problems,
    stale: audit.stale,
    next: audit.stale && audit.problems.length === 0 ? rewritePin(content, 'i18n', target) : null,
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

  // fail closed：预期目录/文件缺失、目录零 html 都必须点名路径退出（不得静默跳过）
  for (const dir of htmlDirs) {
    const abs = join(root, dir)
    if (!existsSync(abs)) {
      invalid.push({ path: dir, problems: ['预期 html 目录不存在'] })
      continue
    }
    const htmls = readdirSync(abs).filter((name) => name.endsWith('.html'))
    if (htmls.length === 0) {
      invalid.push({ path: dir, problems: ['预期 html 目录存在但零 html 文件'] })
      continue
    }
    for (const name of htmls) scanFile(join(abs, name), 'html')
  }
  for (const rel of pinnedJsFiles) {
    const abs = join(root, rel)
    if (!existsSync(abs)) {
      invalid.push({ path: rel, problems: ['预期 i18n.js 文件不存在'] })
      continue
    }
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
    // —— fix round 2：合法+非法混合声明、缺失路径、显式版本 CLI ——
    {
      name: 'i18n 一个合法 pin + 一个 malformed（@2.6）→ fail closed',
      files: {
        html: fixtureHtml(OK, OK),
        i18n: "const A = 'https://unpkg.com/@oas-ui/i18n@2.6.4/dist/en.js'\nconst B = 'https://unpkg.com/@oas-ui/i18n@2.6/dist/en.js'\n",
      },
      check: 1,
      write: 1,
    },
    {
      name: 'i18n 一个合法 pin + 一个模板变量 → fail closed',
      files: {
        html: fixtureHtml(OK, OK),
        i18n: "const A = 'https://unpkg.com/@oas-ui/i18n@2.6.4/dist/en.js'\nconst B = 'https://unpkg.com/@oas-ui/i18n@' + '$' + '{COMPONENT_VERSION}/dist/en.js'\n",
      },
      check: 1,
      write: 1,
    },
    {
      name: 'html theme 一个合法 pin + 一个 malformed（@2.6）→ fail closed',
      raw: `<!doctype html><html><head>
<link rel="stylesheet" href="https://unpkg.com/@oas-ui/theme@2.6.4/index.css" />
<link rel="stylesheet" href="https://unpkg.com/@oas-ui/theme@2.6/skins.css" />
<script src="https://unpkg.com/@oas-ui/ui@2.6.4/dist/cdn.js"></script>
</head><body></body></html>`,
      files: { i18n: fixtureI18n(OK) },
      check: 1,
      write: 1,
    },
    {
      name: '预期 i18n.js 缺失（只写 html）→ fail closed 并点名路径',
      setup(root) {
        mkdirSync(join(root, 'templates/admin-pro/cdn'), { recursive: true })
        writeFileSync(join(root, 'templates/admin-pro/cdn/index.html'), fixtureHtml(OK, OK))
      },
      check: 1,
      write: 1,
    },
    {
      name: '预期 html 目录缺失（只写 i18n.js）→ fail closed 并点名路径',
      setup(root) {
        mkdirSync(join(root, 'templates/admin-pro/cdn'), { recursive: true })
        writeFileSync(join(root, 'templates/admin-pro/cdn/i18n.js'), fixtureI18n(OK))
      },
      check: 1,
      write: 1,
    },
    {
      name: 'html 目录存在但零 html 文件 → fail closed',
      setup(root) {
        mkdirSync(join(root, 'templates/admin-pro/cdn'), { recursive: true })
        writeFileSync(join(root, 'templates/admin-pro/cdn/placeholder.css'), 'body{}')
        writeFileSync(join(root, 'templates/admin-pro/cdn/i18n.js'), fixtureI18n(OK))
      },
      check: 1,
      write: 1,
    },
    {
      name: '显式版本 CLI（无 --root）：2.5.7 直接生效，不回退 installedVersion',
      setup(root) {
        mkdirSync(join(root, 'templates/admin-pro/cdn'), { recursive: true })
        mkdirSync(join(root, 'templates/admin-pro/cdn-mpa/js'), { recursive: true })
        writeFileSync(join(root, 'templates/admin-pro/cdn/index.html'), fixtureHtml(OK, OK))
        writeFileSync(join(root, 'templates/admin-pro/cdn/i18n.js'), fixtureI18n(OK))
        writeFileSync(join(root, 'templates/admin-pro/cdn-mpa/index.html'), fixtureHtml(OK, OK))
        writeFileSync(join(root, 'templates/admin-pro/cdn-mpa/js/i18n.js'), fixtureI18n(OK))
      },
      // cwd=root 且不带 --root：tmp 无任何 node_modules——若回退 installedVersion 会抛错 exit 1
      cli: { args: ['2.5.7'], cwd: true },
      check: null,
      write: 0,
      expectHtml: fixtureHtml('2.5.7', '2.5.7'),
      expectI18n: fixtureI18n('2.5.7'),
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
    const i18nFile = join(root, 'templates/admin-pro/cdn/i18n.js')
    mkdirSync(htmlDir, { recursive: true })
    if (c.setup) {
      c.setup(root)
    } else {
      mkdirSync(join(root, 'templates/admin-pro/cdn-mpa/js'), { recursive: true })
      writeFileSync(join(htmlDir, 'index.html'), c.raw ?? c.files.html)
      writeFileSync(i18nFile, c.files.i18n ?? fixtureI18n(OK))
      // mpa 占位（恒为对齐态）：CLI 会扫描两套模板，占位避免 ENOENT 且不干扰断言
      writeFileSync(join(root, 'templates/admin-pro/cdn-mpa/index.html'), fixtureHtml(OK, OK))
      writeFileSync(join(root, 'templates/admin-pro/cdn-mpa/js/i18n.js'), fixtureI18n(OK))
    }
    // 显式版本且无 --root 的用例：cwd 指向临时根——tmp 无 node_modules，若 CLI 回退 installedVersion 会抛错退出
    const check =
      c.check === null
        ? null
        : spawnSync(process.execPath, [script, '--check', '--root', root, OK], { encoding: 'utf8' })
    const write = spawnSync(
      process.execPath,
      [script, ...(c.cli?.args ?? []), ...(c.cli?.cwd ? [] : ['--root', root, OK])],
      { encoding: 'utf8', ...(c.cli?.cwd ? { cwd: root } : {}) },
    )
    const problems = []
    if (check !== null && check.status !== c.check)
      problems.push(`check exit ${check.status} ≠ ${c.check}（${String(check.stderr)}）`)
    if (write.status !== c.write)
      problems.push(`write exit ${write.status} ≠ ${c.write}（${String(write.stderr)}）`)
    if (existsSync(join(htmlDir, 'index.html')) && c.expectHtml !== undefined) {
      const htmlAfter = readFileSync(join(htmlDir, 'index.html'), 'utf8')
      if (htmlAfter !== c.expectHtml) problems.push('html 未按预期改写')
    }
    if (c.expectI18n !== undefined) {
      const i18nAfter = readFileSync(i18nFile, 'utf8')
      if (i18nAfter !== c.expectI18n) problems.push('i18n.js 未按预期改写')
    }
    if (problems.length > 0) {
      failed++
      console.error(`✗ [${i + 1}/${cases.length}] ${c.name}`)
      for (const p of problems)
        console.error(`    ${p.split('\n').slice(-3).join(' | ').slice(0, 220)}`)
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
    // 仅在确实传了 --root 时排除它与其值——裸显式版本（node bump-cdn.mjs 2.5.7）必须生效
    const skip = new Set()
    if (rootIdx >= 0) {
      skip.add(rootIdx)
      skip.add(rootIdx + 1)
    }
    const target =
      argv.find((a, i) => !a.startsWith('--') && !skip.has(i)) ?? installedVersion(process.cwd())
    if (!/^\d+\.\d+\.\d+$/.test(target)) {
      console.error(`非法版本号：${target}`)
      process.exit(1)
    }
    run(root, target, argv.includes('--check'))
  }
}
