// 注意：子路径分组以 dist 实际目录为准（card 在 data 组、empty 在 feedback 组）。
// 部分子组件（如 bottom-navigation-item）由主模块连带 define，无需单独 import。
// @ts-expect-error side-effect register (css-only package, no type entry)
import '@oas-ui/theme'
import '@oas-ui/theme/skins.css'
import '@oas-ui/theme/glass.css'
import '@oas-ui/icons'
import '@oas-ui/ui/navigation/app-bar'
import '@oas-ui/ui/navigation/bottom-navigation'
import '@oas-ui/ui/navigation/float-button'
import '@oas-ui/ui/feedback/bottom-sheet'
import '@oas-ui/ui/data/card'
import '@oas-ui/ui/basic/button'
import '@oas-ui/ui/basic/tag'
import '@oas-ui/ui/basic/icon'
import '@oas-ui/ui/feedback/empty'
import '@oas-ui/ui/form/input'
import '@oas-ui/ui/form/textarea'
import '@oas-ui/ui/form/switch'
import './styles/app.css'

import { mountApp } from './app'

mountApp(document.querySelector<HTMLDivElement>('#app')!)

// PWA：生产构建注册应用壳 SW（dev 不注册，避免调试干扰与模块缓存混淆）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* 注册失败不阻断应用（离线能力为渐进增强） */
    })
  })
}
