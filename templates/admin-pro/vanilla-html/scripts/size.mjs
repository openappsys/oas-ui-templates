import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

// 2026-09-28 重定档（@oas-ui/* 2.5.7 实测）：registry 白名单随能力示范扩至 67 组件，
// 组件库本体（form-associated/对比度门禁/移动专项等批次）体积持续增长——
// entry 实测 367.2KB、total 489.9KB gzip，预算按实测 + ~9% 余量重定。
// vanilla 已是按需注册模式，无进一步回落空间；后续增长应逐批评估。
const BUDGETS = {
  entry: 400000,
  dashboard: 20480,
  total: 534000,
}

const ASSETS_DIR = 'dist/assets'

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

const files = readdirSync(ASSETS_DIR)
  .filter((name) => name.endsWith('.js'))
  .map((name) => {
    const raw = readFileSync(join(ASSETS_DIR, name))
    return { name, raw: raw.length, gzip: gzipSync(raw).length }
  })
  .sort((a, b) => b.gzip - a.gzip)

const entry = files.find((f) => !f.name.includes('dashboard'))
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
