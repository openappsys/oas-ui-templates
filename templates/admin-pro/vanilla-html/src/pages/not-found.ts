import { onLocaleChange, t } from '../i18n'

export function render(el: HTMLElement): () => void {
  function draw(): void {
    el.innerHTML = `
      <div class="page notice">
        <oas-icon class="notice-icon notice-icon--search" name="search" size="28"></oas-icon>
        <div class="notice-code">404</div>
        <h1 class="notice-title">${t('common.404.title')}</h1>
        <p class="notice-desc">${t('common.404.desc')}</p>
        <oas-button type="primary" data-action="home">${t('common.home')}</oas-button>
      </div>`
    el.querySelector('[data-action="home"]')?.addEventListener('click', () => {
      location.hash = '#/dashboard'
    })
  }
  draw()
  return onLocaleChange(draw)
}
