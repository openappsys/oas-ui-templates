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

/** 首次进入的种子提示：10W 行写入需数秒，先给明确反馈再挂载 React */
export function seedingText(): string {
  return bootLang() === 'zh'
    ? '正在准备示例数据（首次进入约需数秒）…'
    : 'Preparing demo data (a few seconds on first load)…'
}

/** 种子期间的启动页；沿用失败页的配色与字体，减少两套观感 */
export function loadingPage(text: string): void {
  const app = document.querySelector('#app')
  if (!app) return
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:14px;font-family:system-ui,sans-serif;color:#475569;background:#f5f7fa">
      <div class="boot-spinner" style="width:28px;height:28px;border:3px solid #dbe3ee;border-top-color:#0b6cff;border-radius:50%;animation:oas-boot-spin .8s linear infinite"></div>
      <p style="margin:0;font-size:13px">${text}</p>
      <style>
        @keyframes oas-boot-spin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion: reduce){.boot-spinner{animation:none !important}}
      </style>
    </div>`
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
