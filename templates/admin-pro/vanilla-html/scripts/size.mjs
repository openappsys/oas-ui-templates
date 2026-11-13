import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

// 2026-09-28 重定档（@oas-ui/* 2.5.7 实测）：registry 白名单随能力示范扩至 67 组件，
// 组件库本体（form-associated/对比度门禁/移动专项等批次）体积持续增长——
// entry 实测 367.2KB、total 489.9KB gzip，预算按实测 + ~9% 余量重定。
// 2026-11-13 为 /screen 地图特性（maplibre-gl）上调：多入口后 screen chunk（主线程
// 283KB）+ worker（.mjs 144KB，setWorkerUrl 指向、建图时 fetch，与 screen chunk 同库同页）
// 均只被 screen.html 加载，一并计入 total（口径一致，排除 worker 会低估 ~140KB）。
// 实测 entry 320.4KB、total 901.1KB gzip；total 预算按实测 + ~9% 余量重定，
// entry/dashboard 预算沿用 2026-09-28 旧档不变（entry 多入口拆分后实测降至 320.4KB）。
const BUDGETS = {
  entry: 400000,
  dashboard: 20480,
  total: 1006000,
}

const ASSETS_DIR = 'dist/assets'

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

// .mjs 一并计入：maplibre worker（setWorkerUrl 指向、建图时 fetch）随 screen.html 加载，
// 与 screen chunk 同库同页，排除会低估地图特性真实成本
const files = readdirSync(ASSETS_DIR)
  .filter((name) => name.endsWith('.js') || name.endsWith('.mjs'))
  .map((name) => {
    const raw = readFileSync(join(ASSETS_DIR, name))
    return { name, raw: raw.length, gzip: gzipSync(raw).length }
  })
  .sort((a, b) => b.gzip - a.gzip)

// 多入口（index + screen）：入口检测须显式锚定 index，
// 旧写法「首个非 dashboard」在 screen chunk 变大后会误判
const entry = files.find((f) => f.name.startsWith('index-'))
const dashboard = files.find((f) => f.name.includes('dashboard'))
const total = files.reduce((sum, f) => sum + f.gzip, 0)

let ok = true
const lines = []

function check(label, actual, budget) {
  lines.push(`${label}: ${format(actual)} / ${format(budget)}`)
  if (actual > budget) ok = false
}

check('entry', entry?.gzip ?? 0, BUDGETS.entry)
check('dashboard', dashboard?.gzip ?? 0, BUDGETS.dashboard)
check('total', total, BUDGETS.total)

for (const f of files) {
  lines.push(`  ${f.name} raw=${format(f.raw)} gzip=${format(f.gzip)}`)
}

lines.push(ok ? 'size budget OK' : 'size budget EXCEEDED')
console.log(lines.join('\n'))
process.exit(ok ? 0 : 1)
