import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { extname, join } from 'node:path'

const root = import.meta.dirname
const dist = join(root, '..', 'dist')
const FILES = ['index.html', 'app.js', 'i18n.js', 'routes.js']
const PAGE_FILES = readdirSync(join(root, '..')).filter(f => f.startsWith('pages-') && f.endsWith('.js'))
// 目录资源：数据层与 i18n 词典（只拷 JS，排除测试产物）
const DIRS = ['data', 'i18n']

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
for (const f of [...FILES, ...PAGE_FILES]) cpSync(join(root, '..', f), join(dist, f))
for (const d of DIRS) {
  mkdirSync(join(dist, d), { recursive: true })
  for (const f of readdirSync(join(root, '..', d))) {
    if (extname(f) === '.js') cpSync(join(root, '..', d, f), join(dist, d, f))
  }
}
console.log(`built ${FILES.length} files + ${DIRS.length} dirs -> dist/`)
