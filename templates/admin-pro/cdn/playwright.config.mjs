import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  // 全量并行下机器负载会拉长保存/刷新链路，5s 缺省被击穿（2.5.7 升级实测），放宽到 10s
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5190',
    // 全局模拟 zh-CN：默认按中文跑断言
    locale: 'zh-CN',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    // index.html 缺失时 / 返回 404，Playwright 判定就绪要求非 404，故探活指向恒存在的 package.json
    url: 'http://localhost:5190/package.json',
    reuseExistingServer: !process.env.CI,
  },
})
