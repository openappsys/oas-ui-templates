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

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

cpSync(join(siteDir, 'index.html'), join(outDir, 'index.html'))

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
    mkdirSync(target, { recursive: true })
    cpSync(distDir, target, { recursive: true })
    deployed.push(relPath)
    process.stdout.write(`  -> /${relPath}/\n`)
  }
}

console.log(`\nsite built in ${relative(root, outDir)}`)
console.log(`deployed: ${deployed.length} template(s)`)
