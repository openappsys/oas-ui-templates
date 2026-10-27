import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createMockHandler } from './src/data/api/mock-server.ts'

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') return Promise.resolve(undefined)
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: { toString(): string }) => {
      raw += chunk.toString()
    })
    req.on('end', () => {
      if (!raw) {
        resolve(undefined)
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

/** 零依赖 mock 后端：dev 与 e2e 共用同一份 handler（与单测直调的是同一实现） */
function mockApi(): Plugin {
  return {
    name: 'pm-mock-api',
    configureServer(server) {
      const handle = createMockHandler()
      server.middlewares.use('/api', (req: IncomingMessage, res: ServerResponse) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          // 204 按语义不带实体（登出）；写 JSON 体会让浏览器把响应当成有体
          if (status === 204) {
            res.end()
            return
          }
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
        }
        readJsonBody(req)
          .then((body) => {
            // connect 已按挂载点剥掉 /api 前缀，这里补回去交给 handler 统一路由
            const url = new URL(req.url ?? '/', 'http://mock.local')
            const out = handle({
              method: req.method ?? 'GET',
              path: `/api${url.pathname}`,
              query: url.searchParams,
              body,
              // Bearer token 原样透传：鉴权在 handler 内统一判定
              authorization: req.headers.authorization ?? null,
            })
            send(out.status, out.body)
          })
          .catch((e: unknown) => {
            send(400, { error: `invalid JSON body: ${(e as Error).message}` })
          })
      })
    },
  }
}

export default defineConfig({
  // 站点部署走 /pm/ 子路径：产物必须用相对路径（绝对 /assets/ 在子路径下 404）
  base: './',
  plugins: [react(), mockApi()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5878 },
})
