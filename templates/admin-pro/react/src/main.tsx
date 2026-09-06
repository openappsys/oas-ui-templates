// 副作用注册 → i18n → 假后端 → 设置重放 → 挂载
// 数据获取层：QueryClientProvider 全局接管（页面数据走 useQuery/useMutation，
// 登录态仍走 session + useSyncExternalStore，两套订阅互不掺和）
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@oas-ui/theme'
import '@oas-ui/ui'
import '@oas-ui/icons'
import './styles/app.css'
import { initI18n } from './i18n'
import { enableFakeFetch } from './api/http'
import { applySettings } from './settings-init'
import App from './App'

// 模块级单例：StrictMode/热更新下不得重建缓存。
// 假后端纯内存无网络抖动：retry 无意义直接关；staleTime 内页签切回命中缓存不重拉；
// 窗口重聚焦不重拉（数据源本地，聚焦刷新只会闪 loading）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

initI18n()
enableFakeFetch()
applySettings()

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
