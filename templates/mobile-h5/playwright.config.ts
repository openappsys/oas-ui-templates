/// <reference types="node" />
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5877',
    locale: 'zh-CN',
    // 移动端视口：iPhone 12/13/14 尺寸
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  },
  webServer: {
    command: 'pnpm exec vite --port 5877 --strictPort',
    url: 'http://localhost:5877',
    reuseExistingServer: false,
  },
})
