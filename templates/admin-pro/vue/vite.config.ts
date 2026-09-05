import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // oas-* 是 Web Components，不走 Vue 组件解析
          isCustomElement: (tag) => tag.startsWith('oas-'),
        },
      },
    }),
  ],
  base: './',
  server: { port: 5192, strictPort: true },
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts'] },
})
