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
import '@oas-ui/ui/form/form'
import '@oas-ui/ui/form/form-item'
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
// 顶栏 / 侧栏用到的导航组件：app-bar（三段式容器）、dropdown（设置/用户菜单，含内层 menu）
import '@oas-ui/ui/navigation/app-bar'
import '@oas-ui/ui/navigation/dropdown'
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
import { dexieRepositories } from './data/dexie'
import { activeDataSource, type DataSource } from './data/source'
import { RepositoriesProvider } from './data/context'
import type { Repositories } from './data/types'
import { initTheme } from './lib/theme'
import { bindKeys } from './lib/keyboard'

// 启动兜底：IndexedDB 不可用/配额满/隐私模式 → 错误页而非白屏
import { resultPage, bootText, loadingPage, seedingText } from './boot-fallback'
import { loadLang, setLang } from './i18n'

/**
 * API 适配器只在 DEV 可被选中（activeDataSource() 在生产硬锁 dexie）。
 * 静态引入会让整套 HTTP 实现在生产入口包里常驻，故按 DEV 条件动态导入：
 * 生产构建里 `import.meta.env.DEV` 变 false，分支连同 import 一起被 DCE 掉。
 */
async function resolveRepositories(dataSource: DataSource): Promise<Repositories> {
  if (dataSource === 'api' && import.meta.env.DEV) {
    const { createApiRepositories } = await import('./data/api/client')
    return createApiRepositories()
  }
  return dexieRepositories
}

async function boot(): Promise<void> {
  setLang(loadLang())

  const dataSource = activeDataSource()
  if (dataSource === 'dexie') {
    try {
      // 种子必须早于挂载：10W 行写入期间若已挂载，liveQuery 会被持续写入反复重启，
      // 侧栏计数/总数长期停在 0（且看不到保存的视图）；启动页给明确反馈，写完再渲染。
      loadingPage(seedingText())
      await seedDatabase()
    } catch (e) {
      console.error(e)
      resultPage(bootText().title, String((e as Error)?.message ?? e))
      return
    }
  }

  initTheme()
  bindKeys()

  // API 模式需要等适配器模块到位再挂载，否则 Provider 会退回默认的 dexie 仓库
  let repositories: Repositories
  try {
    repositories = await resolveRepositories(dataSource)
  } catch (e) {
    console.error(e)
    resultPage(bootText().title, String((e as Error)?.message ?? e))
    return
  }

  createRoot(document.querySelector<HTMLDivElement>('#app')!).render(
    <StrictMode>
      <RepositoriesProvider value={repositories}>
        <App />
      </RepositoriesProvider>
    </StrictMode>,
  )
}

void boot()
