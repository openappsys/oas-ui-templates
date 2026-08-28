import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, normalize, extname, sep } from 'node:path'

const ROOT = normalize(join(import.meta.dirname, '..'))
const PORT = Number(process.env.PORT || 5191)
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

createServer(async (req, res) => {
  let p = (req.url || '/').split('?')[0]
  try {
    p = decodeURIComponent(p)
  } catch {}
  if (p === '/' || p === '') p = '/index.html'
  const fp = normalize(join(ROOT, p))
  if (fp !== ROOT && !fp.startsWith(ROOT + sep)) {
    res.statusCode = 403
    return res.end()
  }
  try {
    const body = await readFile(fp)
    res.setHeader('Content-Type', MIME[extname(fp)] ?? 'application/octet-stream')
    res.end(body)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
}).listen(PORT, process.env.HOST || '127.0.0.1', () =>
  console.log(`serving ${ROOT} on http://localhost:${PORT}`),
)
