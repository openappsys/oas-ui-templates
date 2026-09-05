// src/main.tsx —— 初始化顺序与 vanilla main.ts 对齐：
// 副作用注册 → i18n → 假后端 → 挂载 → 设置重放
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@oas-ui/theme'
import '@oas-ui/ui'
import '@oas-ui/icons'
import './styles/app.css'
import { initI18n } from './i18n'
import { enableFakeFetch } from './api/http'
import { applySettings } from './settings-init'
import App from './App'

initI18n()
enableFakeFetch()
applySettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
