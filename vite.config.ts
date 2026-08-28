import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// 根 vite 配置：门户 dev 编排（仓库根层职责，模板零改动）
// - / 服务 site/index.html 门户首页（改动即整页刷新：watcher + full-reload）
// - /<family>/<tpl>/ 代理到该模板的 vite dev（http + websocket，vite 内建 server.proxy）
// - 新增模板（如 admin-pro/cdn）只要带 dev 脚本即自动接入，无需改本文件或模板配置
// 端口分配与 scripts/dev.mjs 保持同一约定：模板 vite 从 5181 起

const root = fileURLToPath(new URL('.', import.meta.url))
const portalFile = join(root, 'site', 'index.html')

function discoverTemplates() {
  const out = []
  const templatesRoot = join(root, 'templates')
  for (const family of readdirSync(templatesRoot, { withFileTypes: true })) {
    if (!family.isDirectory()) continue
    for (const tpl of readdirSync(join(templatesRoot, family.name), { withFileTypes: true })) {
      if (!tpl.isDirectory()) continue
      const pkgFile = join(templatesRoot, family.name, tpl.name, 'package.json')
      if (!existsSync(pkgFile)) continue
      const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
      if (pkg.scripts?.dev) {
        out.push({ name: pkg.name, subpath: `/${family.name}/${tpl.name}` })
      }
    }
  }
  out.forEach((t, i) => (t.port = 5181 + i))
  return out
}

const templates = discoverTemplates()

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 5300,
    strictPort: true,
    proxy: Object.fromEntries(
      templates.map((t) => [`${t.subpath}/`, { target: `http://localhost:${t.port}`, ws: true }]),
    ),
  },
  plugins: [
    {
      name: 'portal-index',
      configureServer(server) {
        server.watcher.add(portalFile)
        server.watcher.on('change', (file) => {
          if (file.replace(/\\/g, '/') === portalFile.replace(/\\/g, '/'))
            server.ws.send({ type: 'full-reload', path: '/index.html' })
        })
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            res.setHeader('content-type', 'text/html; charset=utf-8')
            res.end(
              readFileSync(portalFile, 'utf8').replace(
                '</head>',
                '<script type="module" src="/@vite/client"></script></head>',
              ),
            )
            return
          }
          next()
        })
      },
    },
  ],
})
