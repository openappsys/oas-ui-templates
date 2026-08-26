import './components/registry'
import './styles/app.css'
import { iconRegistry } from '@oas-ui/icons'
import { initI18n } from './i18n'
import { enableFakeFetch } from './api/http'
import { mountApp } from './components/app-shell'
import { initRouter } from './router/router'
import { applySettings } from './settings-init'

const registry = iconRegistry as unknown as Record<string, string>
registry['organization'] =
  '<path d="M8 3 V6 M3 6 H13 M3 6 V8 M8 6 V8 M13 6 V8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="3" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="3" cy="9.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="9.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="13" cy="9.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 10.7 V12 H13 V10.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'

initI18n()
enableFakeFetch()
const root = document.querySelector<HTMLDivElement>('#app')!
mountApp(root)
applySettings()
initRouter(root.querySelector<HTMLElement>('#view')!)
