import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  // 全量并行下机器负载会拉长保存/刷新链路，5s 缺省被击穿（2.5.7 升级实测），放宽到 10s
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5187',
    // 全局模拟 zh-CN：默认按中文跑断言，i18n/入口语言相关用例单独用 test.use({ locale: 'en-US' }) 覆盖
    locale: 'zh-CN',
  },
  webServer: {
    command: 'pnpm exec vite --port 5187 --strictPort',
    url: 'http://localhost:5187',
    reuseExistingServer: !process.env.CI,
  },
})
