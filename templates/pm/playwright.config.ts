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
    reuseExistingServer: !process.env.CI,
  },
})
