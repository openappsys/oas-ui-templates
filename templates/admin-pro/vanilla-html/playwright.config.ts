import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5174',
    // 全局模拟 zh-CN：默认按中文跑断言，i18n/入口语言相关用例单独用 test.use({ locale: 'en-US' }) 覆盖
    locale: 'zh-CN',
  },
  webServer: {
    command: 'pnpm exec vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
  },
})
