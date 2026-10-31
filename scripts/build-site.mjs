import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const siteDir = join(root, 'site')
const outDir = join(siteDir, 'dist')
const templatesRoot = join(root, 'templates')

function pkgName(tplDir) {
  const pkg = JSON.parse(readFileSync(join(tplDir, 'package.json'), 'utf8'))
  return pkg.name
}

const families = readdirSync(templatesRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

// 不主动 rm dist 自身（Windows 上若被 dev server / 静态预览锁住会 EPERM）；
// dist 内部产物（每个模板的子目录）在循环里逐项清空再写，行为等价。
function safeRm(p) {
  if (!existsSync(p)) return
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      rmSync(p, { recursive: true, force: true })
      return
    } catch (e) {
      if (e && (e.code === 'EPERM' || e.code === 'EBUSY' || e.code === 'ENOTEMPTY')) {
        if (attempt === 3) {
          throw new Error(
            `could not clean ${p} (${e.code}) after 3 attempts — 关闭占用该目录的进程后重试`,
          )
        }
        execSync(`timeout /t 2 /nobreak >nul`, { shell: 'cmd.exe' })
      } else {
        throw e
      }
    }
  }
}
mkdirSync(outDir, { recursive: true })

cpSync(join(siteDir, 'index.html'), join(outDir, 'index.html'))
// 门户静态资源（OG 社交预览图）随 index.html 一起发布到 dist 顶层
for (const staticFile of ['og.png']) {
  const src = join(siteDir, staticFile)
  if (existsSync(src)) cpSync(src, join(outDir, staticFile))
}

// SEO：robots/sitemap 按部署域名生成（域名无关原则——HTML 内全部相对引用，
// 唯一需要绝对域名的 sitemap loc 由 SITE_URL 环境变量在构建期注入）
const SITE_URL = (process.env.SITE_URL ?? 'https://oas-ui-templates.com').replace(/\/+$/, '')
// 模板路径从 templates/ 实际包自动发现（含 package.json 的目录即一个可部署模板）
// ——不再手工维护清单；并校验首页（f-card 卡片 + JSON-LD hasPart）已覆盖全部模板，
// 防止「加模板漏改 4 处」的散点维护再次发生
const discovered = []
for (const family of families) {
  const familyDir = join(templatesRoot, family)
  if (existsSync(join(familyDir, 'package.json'))) {
    discovered.push(family)
    continue
  }
  for (const tpl of readdirSync(familyDir, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  )) {
    if (existsSync(join(familyDir, tpl.name, 'package.json'))) {
      discovered.push(`${family}/${tpl.name}`)
    }
  }
}
discovered.sort()
const indexHtml = readFileSync(join(siteDir, 'index.html'), 'utf8')
const cardPaths = [...indexHtml.matchAll(/class="f-card" href="\.\/([^"]+)\/"/g)].map((m) => m[1])
const jsonLdPaths = [
  ...indexHtml.matchAll(
    /"@type": "WebPage", "name": "[^"]*", "url": "https:\/\/[^/]+\/([^"]+)\/"/g,
  ),
].map((m) => m[1])
const gaps = [
  ['f-card', discovered, cardPaths],
  ['JSON-LD', discovered, jsonLdPaths],
].flatMap(([label, need, have]) => [
  ...need.filter((p) => !have.includes(p)).map((p) => `${label} 缺少: ${p}`),
  ...have.filter((p) => !need.includes(p)).map((p) => `${label} 多余: ${p}`),
])
if (gaps.length > 0) {
  console.error(`seo: 首页与实际模板不一致，请同步 site/index.html：\n  ${gaps.join('\n  ')}`)
  process.exitCode = 1
  throw new Error('template registry mismatch')
}
const TPL_PATHS = discovered
process.stdout.write(`seo: 模板清单校验通过（${TPL_PATHS.length} 个）\n`)
if (SITE_URL) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
${TPL_PATHS.map(
  (p) =>
    `  <url><loc>${SITE_URL}/${p}/</loc><changefreq>weekly</changefreq><priority>${p.startsWith('admin-pro') ? 0.8 : 0.7}</priority></url>`,
).join('\n')}
</urlset>
`
  writeFileSync(join(outDir, 'sitemap.xml'), sitemap)
  writeFileSync(
    join(outDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
  )
  process.stdout.write(`seo: robots.txt + sitemap.xml (${SITE_URL})\n`)
} else {
  writeFileSync(join(outDir, 'robots.txt'), 'User-agent: *\nAllow: /\n')
  rmSync(join(outDir, 'sitemap.xml'), { force: true })
  process.stdout.write('seo: robots.txt（无 SITE_URL，跳过 sitemap）\n')
}

// assets 目录（自托管的 theme css 等）
const assetsDir = join(siteDir, 'assets')
if (existsSync(assetsDir)) cpSync(assetsDir, join(outDir, 'assets'), { recursive: true })

const deployed = []
for (const family of families) {
  const familyDir = join(templatesRoot, family)
  // 扁平单模板（如 mobile-h5：package.json 直接位于家族目录）按单模板部署
  if (existsSync(join(familyDir, 'package.json'))) {
    const distDir = join(familyDir, 'dist')
    process.stdout.write(`build ${family}\n`)
    execSync(`pnpm --filter ${pkgName(familyDir)} build`, { stdio: 'inherit', cwd: root })
    if (!existsSync(distDir)) {
      console.warn(`skip (no dist): ${family}`)
      continue
    }
    const target = join(outDir, family)
    safeRm(target)
    mkdirSync(target, { recursive: true })
    cpSync(distDir, target, { recursive: true, force: true })
    const srcIdx = join(distDir, 'index.html')
    const dstIdx = join(target, 'index.html')
    if (existsSync(srcIdx) && readFileSync(srcIdx, 'utf8') !== readFileSync(dstIdx, 'utf8')) {
      throw new Error(
        `copy verification failed for /${family}/ — index.html 未更新（目标被占用？）`,
      )
    }
    deployed.push(family)
    process.stdout.write(`  -> /${family}/\n`)
    continue
  }
  for (const tpl of readdirSync(familyDir, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  )) {
    const tplDir = join(familyDir, tpl.name)
    const distDir = join(tplDir, 'dist')
    if (!existsSync(join(tplDir, 'package.json'))) continue
    const name = pkgName(tplDir)
    process.stdout.write(`build ${name}\n`)
    execSync(`pnpm --filter ${name} build`, { stdio: 'inherit', cwd: root })
    if (!existsSync(distDir)) {
      console.warn(`skip (no dist): ${family}/${tpl.name}`)
      continue
    }
    const relPath = relative(templatesRoot, join(familyDir, tpl.name)).replace(/\\/g, '/')
    const target = join(outDir, relPath)
    safeRm(target)
    mkdirSync(target, { recursive: true })
    cpSync(distDir, target, { recursive: true, force: true })
    const srcIdx2 = join(distDir, 'index.html')
    const dstIdx2 = join(target, 'index.html')
    if (existsSync(srcIdx2) && readFileSync(srcIdx2, 'utf8') !== readFileSync(dstIdx2, 'utf8')) {
      throw new Error(
        `copy verification failed for /${relPath}/ — index.html 未更新（目标被占用？）`,
      )
    }
    deployed.push(relPath)
    process.stdout.write(`  -> /${relPath}/\n`)
  }
}
