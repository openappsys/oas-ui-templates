import './components/registry'
import './styles/app.css'
import { mountApp } from './components/app-shell'
import { initRouter } from './router/router'
import { applySettings } from './pages/settings'

const root = document.querySelector<HTMLDivElement>('#app')!
mountApp(root)
applySettings()
initRouter(root.querySelector<HTMLElement>('#view')!)
