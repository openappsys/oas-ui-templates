import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  // 全量并行下机器负载会拉长保存/刷新链路，5s 缺省被击穿（2.5.7 升级实测），放宽到 10s
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5174',
    // 全模板 zh-CN，默认按简体中文做断言（i18n/文案相关测试如需英文，请使用 test.use({ locale: 'en-US' }) 覆盖）
    locale: 'zh-CN',
  },
  webServer: {
    command: 'pnpm exec vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
  },
})
