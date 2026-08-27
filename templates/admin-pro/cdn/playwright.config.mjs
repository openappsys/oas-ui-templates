import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5190',
    // 全局模拟 zh-CN：默认按中文跑断言；英文嗅探用例单独 test.use({ locale: 'en-US' })
    locale: 'zh-CN',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    // index.html 缺失时 / 返回 404，Playwright 判定就绪要求非 404，故探活指向恒存在的 package.json
    url: 'http://localhost:5190/package.json',
    reuseExistingServer: !process.env.CI,
  },
})
