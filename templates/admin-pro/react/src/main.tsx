// 副作用注册 → i18n → 假后端 → 设置重放 → 挂载
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

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
