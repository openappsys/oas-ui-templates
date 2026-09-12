// src/main.ts —— 初始化顺序与 react/vue 版对齐：
// 副作用注册 → i18n → 假后端 → 设置重放 → 挂载
import '@oas-ui/theme'
import '@oas-ui/ui'
import '@oas-ui/icons'
import './styles/app.css'
import { mount } from 'svelte'
import { initI18n } from './i18n'
import { enableFakeFetch } from './api/http'
import { applySettings } from './settings-init'
import App from './App.svelte'

initI18n()
enableFakeFetch()
applySettings()

mount(App, { target: document.getElementById('app')! })
