import { onLocaleChange, t } from '../i18n'

export function render(el: HTMLElement): () => void {
  function draw(): void {
    el.innerHTML = `
      <div class="page center-page">
        <oas-result status="warning" title="${t('common.404.title')}" description="${t('common.404.desc')}">
          <oas-space>
            <oas-button type="primary" data-action="home">${t('common.home')}</oas-button>
          </oas-space>
        </oas-result>
      </div>`
    el.querySelector('[data-action="home"]')?.addEventListener('click', () => {
      location.hash = '#/dashboard'
    })
  }
  draw()
  return onLocaleChange(draw)
}
