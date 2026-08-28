import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5191',
    // 全局模拟 zh-CN：默认按中文跑断言
    locale: 'zh-CN',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    // 探活指向恒存在的 package.json（/ 在页面缺失时可能非 200，Playwright 就绪判定不接受 404）
    url: 'http://localhost:5191/package.json',
    reuseExistingServer: !process.env.CI,
  },
})
