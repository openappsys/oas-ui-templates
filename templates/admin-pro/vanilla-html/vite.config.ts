import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        screen: 'screen.html',
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
