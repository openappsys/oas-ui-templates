/**
 * CDN 模板版本对齐：把 cdn / cdn-mpa 全部 html 里钉死的 unpkg 版本
 * （@oas-ui/theme@x.y.z、@oas-ui/ui@x.y.z）改成目标版本。
 *
 * 用法：
 *   node scripts/bump-cdn.mjs            # 对齐到本地 node_modules 已装的 @oas-ui/ui 版本
 *   node scripts/bump-cdn.mjs 2.5.7      # 对齐到指定版本
 *   node scripts/bump-cdn.mjs --check    # 只报告不一致，不改动（CI 可用）
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const dirs = ['templates/admin-pro/cdn', 'templates/admin-pro/cdn-mpa']
const VERSION_RE = /(@oas-ui\/(?:theme|ui)@)(\d+\.\d+\.\d+)/g

function installedVersion() {
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

const arg = process.argv[2]
const checkOnly = arg === '--check'
const target = checkOnly ? installedVersion() : (arg ?? installedVersion())
if (!/^\d+\.\d+\.\d+$/.test(target)) {
  console.error(`非法版本号：${target}`)
  process.exit(1)
}

let files = 0
let changed = 0
const stale = []
for (const dir of dirs) {
  for (const name of readdirSync(join(root, dir))) {
    if (!name.endsWith('.html')) continue
    files++
    const p = join(root, dir, name)
    const src = readFileSync(p, 'utf8')
    const next = src.replace(VERSION_RE, (_, prefix) => `${prefix}${target}`)
    if (next !== src) {
      if (checkOnly) {
        stale.push(`${dir}/${name}`)
      } else {
        writeFileSync(p, next)
        changed++
        console.log(`  ${dir}/${name}`)
      }
    }
  }
}

if (checkOnly) {
  if (stale.length > 0) {
    console.error(`以下 html 的 unpkg 版本未对齐到 ${target}：`)
    for (const s of stale) console.error(`  ${s}`)
    process.exit(1)
  }
  console.log(`check ok：${files} 个 html 均已对齐 @2.5.x → @${target}`)
} else {
  console.log(`done：${changed}/${files} 个 html → @${target}`)
}
