// 入口防 FOUC：每页 <head> 同步引入，与 i18n.js detectLocale 逻辑一致
// 优先级：localStorage 已保存 → navigator.language 嗅探（zh 系列 → zh-CN，其余一律 en）
// 同步锚定：改 KEY / 嗅探规则须同步修改 i18n.js
;(function () {
  try {
    var saved = localStorage.getItem('oas-admin-cdn-mpa.locale')
    if (saved === 'zh-CN' || saved === 'en') {
      document.documentElement.lang = saved
      return
    }
    var nav = (navigator.language || '').toLowerCase()
    document.documentElement.lang = nav === 'zh' || nav.indexOf('zh-') === 0 ? 'zh-CN' : 'en'
  } catch (e) {
    /* 无 storage / noop */
  }
})()
