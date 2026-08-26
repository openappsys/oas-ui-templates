import { onLocaleChange, t } from '../i18n'

export function render(el: HTMLElement): () => void {
  function draw(): void {
    el.innerHTML = `
      <div class="page notice">
        <oas-icon class="notice-icon notice-icon--lock" name="lock" size="28"></oas-icon>
        <div class="notice-code">403</div>
        <h1 class="notice-title">${t('common.403.title')}</h1>
        <p class="notice-desc">${t('common.403.desc')}</p>
        <div class="notice-actions">
          <oas-button type="default" variant="outlined" data-action="back">${t('common.back')}</oas-button>
          <oas-button type="primary" data-action="home">${t('common.home')}</oas-button>
        </div>
      </div>`
    el.querySelector('[data-action="home"]')?.addEventListener('click', () => {
      location.hash = '#/dashboard'
    })
    el.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      if (history.length > 1) history.back()
      else location.hash = '#/dashboard'
    })
  }
  draw()
  return onLocaleChange(draw)
}
