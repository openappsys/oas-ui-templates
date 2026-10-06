/// <reference types="node" />
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5879',
    locale: 'zh-CN',
    viewport: { width: 1366, height: 850 },
  },
  webServer: {
    command: 'pnpm exec vite --port 5879 --strictPort',
    url: 'http://localhost:5879',
    reuseExistingServer: !process.env.CI,
  },
})
