import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t } from './i18n.js'

// 403 / 404 / 500 三页共享脚本：页面 DOM 静态写在 HTML（data-i18n 换文），
// 此处只做壳层接线与 返回/回首页 按钮导航
if (guard()) {
  const page = document.querySelector('.page.notice')
  const titleKey = page?.getAttribute('data-title-key') ?? 'common.404.title'
  document.title = `${t(titleKey)} · ${t('app.title')}`
  applyStaticTexts()
  // 侧栏高亮当前页（三页均在侧栏「示例」组内），active 取当前文件名
  initShell({ active: `./${location.pathname.split('/').pop()}` })

  document
    .querySelector('[data-action="home"]')
    .addEventListener('click', () => (location.href = './dashboard.html'))
  document.querySelector('[data-action="back"]').addEventListener('click', () => {
    if (history.length > 1) history.back()
    else location.href = './dashboard.html'
  })
}
