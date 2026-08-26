import { onLocaleChange, t } from '../i18n'

export function render(el: HTMLElement): () => void {
  function draw(): void {
    el.innerHTML = `
      <div class="page notice">
        <div class="notice-code">403</div>
        <h1 class="notice-title">${t('common.403.title')}</h1>
        <p class="notice-desc">${t('common.403.desc')}</p>
        <oas-button type="primary" data-action="home">${t('common.home')}</oas-button>
      </div>`
    el.querySelector('[data-action="home"]')?.addEventListener('click', () => {
      location.hash = '#/dashboard'
    })
  }
  draw()
  return onLocaleChange(draw)
}
