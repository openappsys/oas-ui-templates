// src/components/app-shell.tsx —— 布局壳占位：Task 5 实现完整壳（侧栏/页签栏/头部）
// 本任务仅渲染 Outlet，保证路由组装可编译可运行
import { Outlet } from 'react-router'

export function AppShell() {
  return <Outlet />
}
