// 入口防 FOUC：每页 <head> 同步引入，与 i18n.js detectLocale 逻辑一致
// 优先级：localStorage 已保存 → navigator.language 嗅探（zh 系列 → zh-CN，其余一律 en）
// 同步锚定：改 KEY / 嗅探规则须同步修改 i18n.js
;(() => {
  try {
    const saved = localStorage.getItem('oas-admin-cdn-mpa.locale')
    if (saved === 'zh-CN' || saved === 'en') {
      document.documentElement.lang = saved
    } else {
      const nav = (navigator.language || '').toLowerCase()
      document.documentElement.lang = nav === 'zh' || nav.indexOf('zh-') === 0 ? 'zh-CN' : 'en'
    }
  } catch {
    /* 无 storage / noop */
  }

  // 设置中心（js/settings.js）外观偏好的启动重放：主题色 / 圆角 / 表格密度 / 字号 / 自定义 token
  // 同步锚定：改键名须同步修改 js/settings.js（前缀 oas-admin-cdn-mpa.settings.*）
  try {
    const root = document.documentElement
    const theme =
      root.dataset.theme === 'dark' ? 'dark' : root.dataset.theme === 'light' ? 'light' : 'light'
    const stored = (k) => {
      try {
        return localStorage.getItem(k)
      } catch {
        return null
      }
    }
    const color = stored('oas-admin-cdn-mpa.settings.theme.' + theme)
    if (color) root.style.setProperty('--oas-color-primary', color)
    const radius = Number(stored('oas-admin-cdn-mpa.settings.radius'))
    if (Number.isFinite(radius) && radius > 0)
      root.style.setProperty('--oas-radius-md', radius + 'px')
    const density = stored('oas-admin-cdn-mpa.settings.table-density')
    const pad = density === 'compact' ? '6px' : density === 'large' ? '16px' : '12px'
    root.style.setProperty('--oas-table-cell-padding-block', pad)
    const fontScale = {
      xs: '0.875',
      sm: '0.9375',
      md: '1',
      lg: '1.0625',
      xl: '1.125',
    }[stored('oas-admin-cdn-mpa.settings.font-size') ?? 'md']
    if (fontScale) root.style.setProperty('--app-font-scale', fontScale)
    const rawTokens = stored('oas-admin-cdn-mpa.settings.custom-tokens')
    if (rawTokens) {
      const map = JSON.parse(rawTokens)
      for (const k in map) {
        if (Object.hasOwn(map, k) && typeof k === 'string' && k.startsWith('--'))
          root.style.setProperty(k, map[k])
      }
    }
  } catch {
    /* 忽略损坏数据 */
  }
})()
