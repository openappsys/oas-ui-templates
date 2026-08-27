import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = import.meta.dirname
const dist = join(root, '..', 'dist')
const FILES = ['index.html', 'app.js', 'i18n.js', 'pages.js']

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
for (const f of FILES) cpSync(join(root, '..', f), join(dist, f))
console.log(`built ${FILES.length} files -> dist/`)
