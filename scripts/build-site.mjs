import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
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
      console.warn(`warn: could not clean ${p} (${e.code}); existing files will be overwritten in place.`)
    } else {
      throw e
    }
  }
}
mkdirSync(outDir, { recursive: true })

cpSync(join(siteDir, 'index.html'), join(outDir, 'index.html'))
// 门户静态资源（OG 社交预览图等）随 index.html 一起发布到 dist 顶层
for (const staticFile of ['og.png']) {
  const src = join(siteDir, staticFile)
  if (existsSync(src)) cpSync(src, join(outDir, staticFile))
}

const deployed = []
for (const family of families) {
  const familyDir = join(templatesRoot, family)
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

console.log(`\nsite built in ${relative(root, outDir)}`)
console.log(`deployed: ${deployed.length} template(s)`)
