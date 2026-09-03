// Google Analytics 4 —— 仅生产构建采集；与 oas-ui 文档站（packages/docs/docs/.vitepress/config.ts:213）
// 策略一致：vite 构建期把 import.meta.env.PROD 替换为字面量，dev 整段被 tree-shake 掉。
declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}
if (import.meta.env.PROD) {
  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments as unknown) }
  window.gtag('js', new Date())
  window.gtag('config', 'G-RXJ8JG9R19')
  var s = document.createElement('script')
  s.async = true
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-RXJ8JG9R19'
  document.head.appendChild(s)
}
export {}
