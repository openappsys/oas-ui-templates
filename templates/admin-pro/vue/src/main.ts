// src/main.ts —— 初始化顺序与 react 版 main.tsx 对齐：
// 副作用注册 → i18n → 假后端 → 设置重放 → 挂载
import { createApp } from 'vue'
import '@oas-ui/theme'
import '@oas-ui/ui'
import '@oas-ui/icons'
import './styles/app.css'
import { initI18n } from './i18n'
import { enableFakeFetch } from './api/http'
import { applySettings } from './settings-init'
import { router } from './router'
import App from './App.vue'

initI18n()
enableFakeFetch()
applySettings()

createApp(App).use(router).mount('#app')
