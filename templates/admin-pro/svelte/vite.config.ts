import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [svelte()],
  base: './',
  server: { port: 5186, strictPort: true },
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts'] },
})
