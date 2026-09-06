// src/main.ts —— 初始化顺序与 react 版 main.tsx 对齐：
// 副作用注册 → i18n → 假后端 → pinia 安装 → 设置重放（stores/settings 生效器）→ 挂载
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import '@oas-ui/theme'
import '@oas-ui/ui'
import '@oas-ui/icons'
import './styles/app.css'
import { initI18n } from './i18n'
import { enableFakeFetch } from './api/http'
import { initSettingsStore } from './stores/settings'
import { router } from './router'
import App from './App.vue'

initI18n()
enableFakeFetch()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
// 设置重放：读 localStorage → store 状态 → 生效器写 DOM（原 settings-init.applySettings 时序）
initSettingsStore(pinia)
app.use(router)
app.mount('#app')
