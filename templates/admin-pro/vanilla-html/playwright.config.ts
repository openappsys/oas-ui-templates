import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  // 全量并行高并发会放大 fakeFetch/动画时序竞争（表单两段式用例必挂），收敛并发换取结果确定性
  workers: 2,
  // 本地与 CI 统一开重试：全量并行下的负载时序 flaky（动画/网络 mock 抖动）不应污染结果；真回归会被同用例多轮复跑暴露`n  retries: 1,
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
