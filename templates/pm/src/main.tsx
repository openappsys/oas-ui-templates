import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// @ts-expect-error css-only package
import '@oas-ui/theme'
import '@oas-ui/theme/skins.css'
import '@oas-ui/theme/glass.css'
import '@oas-ui/icons/register'
import '@oas-ui/ui/data/card'
import '@oas-ui/ui/data/table'
import '@oas-ui/ui/data/chart'
import '@oas-ui/ui/basic/button'
import '@oas-ui/ui/basic/tag'
import '@oas-ui/ui/basic/icon'
import '@oas-ui/ui/form/input'
import '@oas-ui/ui/form/switch'
import '@oas-ui/ui/form/slider'
import '@oas-ui/ui/feedback/empty'
import '@oas-ui/ui/feedback/modal'
import '@oas-ui/ui/navigation/tabs'
import '@oas-ui/ui/layout/gantt'
import './styles/app.css'

import { App } from './App'
import { seedDatabase } from './seed-db'

// seed 后台跑（不阻塞首屏渲染）；Dexie liveQuery 数据到了自动推送
seedDatabase().catch(console.error)

createRoot(document.querySelector<HTMLDivElement>('#app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
