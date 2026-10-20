import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// @ts-expect-error css-only package
import '@oas-ui/theme'
import '@oas-ui/theme/skins.css'
import '@oas-ui/theme/glass.css'
import '@oas-ui/icons/register'
import '@oas-ui/ui/data/card'
import '@oas-ui/ui/data/avatar'
import '@oas-ui/ui/data/table'
import '@oas-ui/ui/data/chart'
import '@oas-ui/ui/basic/button'
import '@oas-ui/ui/basic/tag'
import '@oas-ui/ui/basic/icon'
import '@oas-ui/ui/form/input'
import '@oas-ui/ui/form/checkbox'
import '@oas-ui/ui/form/switch'
import '@oas-ui/ui/form/slider'
import '@oas-ui/ui/feedback/empty'
import '@oas-ui/ui/feedback/skeleton'
import '@oas-ui/ui/feedback/result'
import '@oas-ui/ui/feedback/modal'
import '@oas-ui/ui/feedback/alert'
import '@oas-ui/ui/navigation/tabs'
import '@oas-ui/ui/navigation/command'
import '@oas-ui/ui/layout/sidebar'
import '@oas-ui/ui/data/gantt'
import '@oas-ui/ui/data/resource'
import '@oas-ui/ui/data/scheduler'
import '@oas-ui/ui/data/kanban'
import '@oas-ui/ui/data/virtual-list'
import '@oas-ui/ui/data/comment'
import '@oas-ui/ui/data/statistic'
import '@oas-ui/ui/data/list'
import '@oas-ui/ui/feedback/drawer'
import '@oas-ui/ui/feedback/popconfirm'
import '@oas-ui/ui/feedback/tooltip'
import '@oas-ui/ui/form/select'
import '@oas-ui/ui/form/date-picker'
import '@oas-ui/ui/form/time-picker'
import '@oas-ui/ui/form/textarea'
import '@oas-ui/ui/form/segmented'
import '@oas-ui/ui/form/dynamic-tags'
import '@oas-ui/ui/form/input-number'
import '@oas-ui/ui/basic/badge'
import '@oas-ui/ui/basic/kbd'
import './styles/app.css'

import { App } from './App'
import { seedDatabase } from './seed-db'
import { apiRepositories } from './data/api/client'
import { dexieRepositories } from './data/dexie'
import { activeDataSource } from './data/source'
import { RepositoriesProvider } from './data/context'
import { initTheme } from './lib/theme'
import { bindKeys } from './lib/keyboard'

// 启动兜底：IndexedDB 不可用/配额满/隐私模式 → 错误页而非白屏
import { resultPage, bootText } from './boot-fallback'
import { loadLang, setLang } from './i18n'
setLang(loadLang())

const dataSource = activeDataSource()
if (dataSource === 'dexie') {
  try {
    // seed 后台跑（不阻塞首屏渲染）；Dexie liveQuery 数据到了自动推送
    seedDatabase().catch((e) => {
      console.error(e)
      resultPage(bootText().title, String(e?.message ?? e))
    })
  } catch (e) {
    console.error(e)
    resultPage(bootText().title, String((e as Error)?.message ?? e))
  }
}

initTheme()
bindKeys()

createRoot(document.querySelector<HTMLDivElement>('#app')!).render(
  <StrictMode>
    <RepositoriesProvider value={dataSource === 'api' ? apiRepositories : dexieRepositories}>
      <App />
    </RepositoriesProvider>
  </StrictMode>,
)
