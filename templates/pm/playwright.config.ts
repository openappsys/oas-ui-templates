/// <reference types="node" />
import { defineConfig } from '@playwright/test'

// 浏览器切换走环境变量而不是双 project：默认（无变量）与历史行为完全一致（仅 chromium），
// CI 只需 `PW_BROWSER=firefox pnpm exec playwright test` 即可换引擎，不必挑 --project。
const BROWSER = process.env.PW_BROWSER === 'firefox' ? 'firefox' : 'chromium'

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
  projects: [
    {
      name: BROWSER,
      use: { browserName: BROWSER },
      // 截图基线是给人复核的产物（shots/*.png 固定文件名）：firefox 跑一遍会覆盖 chromium 的图，
      // 因此截图 spec 只在 chromium 生成；firefox 覆盖功能与交互断言，不覆盖像素产物。
      testIgnore: BROWSER === 'firefox' ? ['**/_shots.spec.ts'] : [],
    },
  ],
  webServer: {
    command: 'pnpm exec vite --port 5878 --strictPort',
    url: 'http://localhost:5878',
    // 不复用已有 server：复用的 server 可能持有重建前的模块缓存（上游 dist 重建后应用无法启动，
    // 表现为 pm-toolbar 缺失 + seed 等待超时）。端口被占时快速失败优于静默跑到超时。
    reuseExistingServer: false,
  },
})
