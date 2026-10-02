/**
 * 移动端 H5 应用壳 service worker（最小实现，无构建期依赖）：
 * - 应用壳（导航请求）cache-first + 后台回填（stale-while-revalidate 语义），
 *   离线可打开；hash 路由单入口，壳命中即整站可用
 * - 同源静态资源（hash 文件名的 vite 产物）：命中直接回、未命中拉取并缓存
 * - unpkg 的 @oas-ui/* 运行时：缓存优先（版本 URL 固定不变质）
 * - 版本号 CACHE_VERSION 递增即弃旧缓存
 */
const CACHE_VERSION = 'mobile-h5-v1'
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  // 应用壳：导航请求 stale-while-revalidate（离线打开的关键路径）
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy))
            }
            return res
          })
          .catch(() => cached)
        return cached ?? network
      }),
    )
    return
  }

  // 同源静态资源 + unpkg 运行时：cache-first（URL 含 hash/版本，天然不变质）
  if (new URL(req.url).origin === self.location.origin || req.url.includes('unpkg.com/@oas-ui/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
