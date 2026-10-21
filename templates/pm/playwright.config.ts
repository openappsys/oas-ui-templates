/// <reference types="node" />
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  // 测试共享同一个 IndexedDB（oas-pm），并行会互相污染 updatedAt 排序窗口
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5878',
    locale: 'zh-CN',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'pnpm exec vite --port 5878 --strictPort',
    url: 'http://localhost:5878',
    // 不复用已有 server：复用的 server 可能持有重建前的模块缓存（上游 dist 重建后应用无法启动，
    // 表现为 pm-toolbar 缺失 + seed 等待超时）。端口被占时快速失败优于静默跑到超时。
    reuseExistingServer: false,
  },
})
