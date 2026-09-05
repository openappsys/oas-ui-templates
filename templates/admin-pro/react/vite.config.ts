import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5182, strictPort: true },
  test: { environment: 'happy-dom', include: ['src/**/*.test.{ts,tsx}'] },
})
