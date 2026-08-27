import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 根 pnpm dev：拉起门户（根 vite，见根 vite.config.ts）+ 各模板的 vite dev
// 模板用 CLI 参数 --base /<family>/<tpl>/ 挂子路径、独立端口（5181 起），模板配置零改动
const root = fileURLToPath(new URL('..', import.meta.url))
const templatesRoot = join(root, 'templates')

const templates = []
for (const family of readdirSync(templatesRoot, { withFileTypes: true })) {
  if (!family.isDirectory()) continue
  for (const tpl of readdirSync(join(templatesRoot, family.name), { withFileTypes: true })) {
    if (!tpl.isDirectory()) continue
    const pkgFile = join(templatesRoot, family.name, tpl.name, 'package.json')
    if (!existsSync(pkgFile)) continue
    const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
    if (pkg.scripts?.dev) {
      templates.push({ name: pkg.name, subpath: `/${family.name}/${tpl.name}` })
    }
  }
}

if (templates.length === 0) {
  console.error('no template with a dev script found under templates/')
  process.exit(1)
}

const children = []
const run = (cmd, args) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: root })
  children.push(child)
}

templates.forEach((t, i) => {
  run('pnpm', [
    '--filter',
    t.name,
    'exec',
    'vite',
    '--port',
    String(5181 + i),
    '--strictPort',
    '--base',
    `${t.subpath}/`,
  ])
})

// 门户最后启动（根 vite.config.ts 里的代理指向上面各端口）
run('pnpm', ['exec', 'vite'])

process.on('SIGINT', () => {
  for (const c of children) c.kill()
  process.exit(0)
})
process.on('exit', () => {
  for (const c of children) c.kill()
})
