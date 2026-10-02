import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

// a11y 两条误报与 svelte-check 的 --compiler-warnings 豁免同源同义：
// oas-* web component 的键盘交互/ARIA 在组件 shadow 内实现，编译器不可见。
// vite build 的 svelte 编译警告不经 svelte-check，需在此独立豁免。
const SVELTE_A11Y_IGNORE = new Set([
  'a11y_click_events_have_key_events',
  'a11y_no_static_element_interactions',
])

export default defineConfig({
  plugins: [
    svelte({
      onwarn(w, defaultHandler) {
        if (SVELTE_A11Y_IGNORE.has(w.code)) return
        defaultHandler(w)
      },
    }),
  ],
  base: './',
  server: { port: 5186, strictPort: true },
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts'] },
})
