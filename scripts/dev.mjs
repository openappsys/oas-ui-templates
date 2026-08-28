import { execSync, spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 根 pnpm dev：拉起门户（根 vite，见根 vite.config.ts）+ 各模板的 vite dev
// 模板用 CLI 参数 --base /<family>/<tpl>/ 挂子路径、独立端口（5181 起），模板配置零改动
const root = fileURLToPath(new URL('..', import.meta.url))
const templatesRoot = join(root, 'templates')
const portalPort = Number(process.env.PORT) || 5300

// 启动前释放将被占用的端口（防止旧 dev 进程僵尸占用门户端口等导致门户起不来、看到陈旧内容）
// Windows：netstat 整行解析（精确匹配本机地址端口 + LISTENING + PID，不误伤 53000 等相邻端口）
// macOS/Linux：lsof 优先、fuser 兜底；都没有则放弃（vite strictPort 会报出清晰的端口占用错误）
function freePort(port) {
  if (process.platform === 'win32') {
    let out
    try {
      out = execSync('netstat -ano -p tcp', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch {
      return
    }
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      // 形如：TCP    0.0.0.0:5300    0.0.0.0:0    LISTENING    12345
      const m = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i)
      if (m && Number(m[1]) === port) pids.add(m[2])
    }
    for (const pid of pids) {
      try {
        process.kill(Number(pid))
      } catch {
        /* 已退出 */
      }
    }
    return
  }
  try {
    execSync(`lsof -ti tcp:${port} | xargs kill`, { stdio: 'ignore' })
    return
  } catch {
    /* lsof 不存在或无监听 */
  }
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
  } catch {
    /* fuser 也不存在：交给 vite strictPort 报错 */
  }
}

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

// 释放门户端口 + 各模板端口（门户 5300，模板 5181..）
freePort(portalPort)
templates.forEach((_, i) => freePort(5181 + i))

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
