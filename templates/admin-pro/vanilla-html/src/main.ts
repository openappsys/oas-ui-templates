import './components/registry'
import './styles/app.css'
import { initI18n } from './i18n'
import { enableFakeFetch } from './api/http'
import { mountApp } from './components/app-shell'
import { initRouter } from './router/router'
import { applySettings } from './settings-init'

initI18n()
enableFakeFetch()
const root = document.querySelector<HTMLDivElement>('#app')!
mountApp(root)
applySettings()
initRouter(root.querySelector<HTMLElement>('#view')!)
