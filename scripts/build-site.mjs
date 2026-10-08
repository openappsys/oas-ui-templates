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
  try {
    rmSync(p, { recursive: true, force: true })
  } catch (e) {
    if (e && (e.code === 'EPERM' || e.code === 'EBUSY' || e.code === 'ENOTEMPTY')) {
      console.warn(
        `warn: could not clean ${p} (${e.code}); existing files will be overwritten in place.`,
      )
    } else {
      throw e
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
const TPL_PATHS = [
  'admin-pro/vanilla-html',
  'admin-pro/cdn',
  'admin-pro/cdn-mpa',
  'admin-pro/react',
  'admin-pro/vue',
  'admin-pro/svelte',
  'mobile-h5',
  'desktop',
]
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
    cpSync(distDir, target, { recursive: true })
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
    cpSync(distDir, target, { recursive: true })
    deployed.push(relPath)
    process.stdout.write(`  -> /${relPath}/\n`)
  }
}


