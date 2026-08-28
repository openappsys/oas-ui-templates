import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const scriptsDir = import.meta.dirname
const src = join(scriptsDir, '..')
const dist = join(src, 'dist')
const FILES = ['index.html', 'dashboard.html', 'users.html', 'form.html']
const DIRS = ['css', 'js']

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
for (const f of FILES) cpSync(join(src, f), join(dist, f))
for (const d of DIRS) cpSync(join(src, d), join(dist, d), { recursive: true })
console.log(`built ${FILES.length} html + ${DIRS.length} dirs -> dist/`)
