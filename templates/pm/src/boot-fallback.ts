/** 启动兜底错误页：IndexedDB 不可用/配额满时替代白屏 */
export function resultPage(title: string, detail: string): void {
  const app = document.querySelector('#app')
  if (app) {
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:12px;font-family:system-ui,sans-serif;color:#1f2329;background:#f5f7fa">
        <div style="font-size:44px;font-weight:700;color:#dc2626">!</div>
        <p style="margin:0;font-size:18px;font-weight:600">${title}</p>
        <p style="margin:0;font-size:13px;color:#64748b;max-width:480px;text-align:center;word-break:break-all">${detail}</p>
        <p style="margin:0;font-size:12px;color:#94a3b8">请检查浏览器隐私模式 / 存储配额，或更换浏览器后重试</p>
      </div>`
  }
}
