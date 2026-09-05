// 根组件：登录态分派在 AppRouter 内完成（未登录仅 /login，已登录 AppShell 布局路由）
import { AppRouter } from './router'

export default function App() {
  return <AppRouter />
}
