/** 启动兜底错误页：IndexedDB 不可用/配额满时替代白屏（React 树外，自含双语文案） */
function bootLang(): 'zh' | 'en' {
  try {
    const l = localStorage.getItem('oas-pm-lang')
    if (l === 'zh' || l === 'en') return l
  } catch {
    // localStorage 不可用（隐私模式）→ 回落 navigator
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function bootText(): { title: string; hint: string } {
  return bootLang() === 'zh'
    ? {
        title: '数据引擎初始化失败',
        hint: '请检查浏览器隐私模式 / 存储配额，或更换浏览器后重试',
      }
    : {
        title: 'Failed to initialize the data engine',
        hint: 'Check private browsing mode / storage quota, or try another browser',
      }
}

export function resultPage(title: string, detail: string): void {
  const app = document.querySelector('#app')
  if (app) {
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:12px;font-family:system-ui,sans-serif;color:#1f2329;background:#f5f7fa">
        <div style="font-size:44px;font-weight:700;color:#dc2626">!</div>
        <p style="margin:0;font-size:18px;font-weight:600">${title}</p>
        <p style="margin:0;font-size:13px;color:#64748b;max-width:480px;text-align:center;word-break:break-all">${detail}</p>
        <p style="margin:0;font-size:12px;color:#94a3b8">${bootText().hint}</p>
      </div>`
  }
}
