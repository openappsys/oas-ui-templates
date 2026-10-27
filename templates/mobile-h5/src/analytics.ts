// Google Analytics 4 接入（与 admin-pro 模板对齐：同一测量 ID，仅生产构建注入——
// vite 静态替换把 import.meta.env.PROD 替换为布尔常量，dev 分支被 tree-shake 掉）
declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}
if (import.meta.env.PROD) {
  window.dataLayer = window.dataLayer || []
  window.gtag = (...args: unknown[]) => {
    window.dataLayer.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', 'G-RXJ8JG9R19')
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-RXJ8JG9R19'
  document.head.appendChild(s)
}
export {}
