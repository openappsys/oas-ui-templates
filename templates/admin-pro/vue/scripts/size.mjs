import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

// 全量 import '@oas-ui/ui' 的教学型模版，预算按实际产物 + 余量设定（2026-09 收口时校准）
const BUDGETS = {
  entry: 512000,
  dashboard: 20480,
  total: 770100,
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
