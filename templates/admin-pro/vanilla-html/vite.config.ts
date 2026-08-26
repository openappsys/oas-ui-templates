import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
