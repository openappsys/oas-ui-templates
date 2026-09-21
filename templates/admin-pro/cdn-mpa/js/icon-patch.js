// cdn.js 图标注册表与 ESM 版不一致：以下 6 个图标在 cdn.js 中缺失 SVG 路径数据
// （上游缺陷已录 oas-ui demands 2026-09-14；此文件从 packages/icons/src/icons/*.ts 逐字提取）
;(() => {
  var paths = {
    calendar:
      '<rect x="3" y="4.5" width="10" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 7.5 H13 M5.5 2.8 V4.8 M10.5 2.8 V4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    edit: '<path d="M11.2 3.3 L12.7 4.8 L6 11.5 L3.5 12.5 L4.5 10 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    'star-filled':
      '<path d="M8 2.5 C6 2.5 4.6 4.2 5.6 5.8 C6.6 7.4 5 8.8 5 8.8 C4.2 9.4 4.6 11 6 11 C7 11 8 12.5 8 13.5 C8 12.5 9 11 10 11 C11.4 11 11.8 9.4 11 8.8 C11 8.8 9.4 7.4 10.4 5.8 C11.4 4.2 10 2.5 8 2.5 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    organization:
      '<rect x="6.5" y="2" width="3" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="11" width="3" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="6.5" y="11" width="3" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="3" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5 V7.5 M3.5 11 V9.5 C3.5 8.4 4.4 7.5 5.5 7.5 H10.5 C11.6 7.5 12.5 8.4 12.5 9.5 V11 M8 7.5 V11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    tree: '<circle cx="4.5" cy="3.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10.5" cy="7.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10.5" cy="12.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 5.2 V12.5 M4.5 7.5 H8.8 M4.5 12.5 H8.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    filter:
      '<path d="M3.5 4.5 H12.5 L8.5 9 V12.5 L7.5 12 V9 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  }
  function apply() {
    if (!window.OASUI || typeof window.OASUI.registerIcon !== 'function') {
      setTimeout(apply, 50)
      return
    }
    for (var name in paths) window.OASUI.registerIcon(name, paths[name])
  }
  apply()
})()
