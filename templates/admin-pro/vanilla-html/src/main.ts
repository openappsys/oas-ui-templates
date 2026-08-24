import '@oas-ui/theme'
import '@oas-ui/ui'
import './styles/app.css'
import { mountApp } from './components/app-shell'
import { initRouter } from './router/router'

const root = document.querySelector<HTMLDivElement>('#app')!
mountApp(root)
initRouter(root.querySelector<HTMLElement>('#view')!)
