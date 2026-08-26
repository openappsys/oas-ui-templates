import { onLocaleChange, t } from '../i18n'
import '../styles/pages/data-board.css'

interface StatDef {
  key: string
  label: string
  value: string
  prefix?: string
  suffix?: string
  toFixed?: string
  anim: boolean
}

export function render(el: HTMLElement): () => void {
  let stop: () => void

  function stats(): StatDef[] {
    return [
      { key: 'gmv', label: t('board.gmv'), value: '12845678', prefix: '¥', anim: true },
      { key: 'orders', label: t('board.orders'), value: '1926', anim: true },
      { key: 'users', label: t('board.users'), value: '328', anim: false },
      {
        key: 'conversion',
        label: t('board.conversion'),
        value: '4.6',
        suffix: '%',
        toFixed: '1',
        anim: false,
      },
    ]
  }

  function statCard(s: StatDef): string {
    const value = s.anim
      ? `<oas-number-animation data-testid="anim-${s.key}" value="${s.value}"${s.toFixed ? ` to-fixed="${s.toFixed}"` : ''}></oas-number-animation>`
      : `<oas-statistic data-testid="stat-${s.key}" value="${s.value}"${s.toFixed ? ` precision="${s.toFixed}"` : ''}>${s.suffix ? `<span slot="suffix">${s.suffix}</span>` : ''}</oas-statistic>`
    return `
      <oas-card class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">
          ${s.prefix ? `<span class="stat-prefix">${s.prefix}</span>` : ''}
          ${value}
        </div>
      </oas-card>`
  }

  function draw(): void {
    const defs = stats()
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div>
            <h1 class="page-title">${t('board.title')}</h1>
            <p class="page-subtitle">${t('board.subtitle')}</p>
          </div>
        </div>
        <oas-watermark text="OAS Admin Pro" repeat opacity="0.12">
          <div class="board-grid" id="board-grid">${defs.map(statCard).join('')}</div>
          <oas-card class="board-note" title="${t('board.refreshTitle')}">
            <div class="board-refresh">
              <oas-button data-action="refresh" type="primary">${t('board.refresh')}</oas-button>
              <span class="board-hint">${t('board.refreshHint')}</span>
            </div>
          </oas-card>
        </oas-watermark>
      </div>`

    el.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
      let i = 0
      for (const s of defs) {
        if (!s.anim) continue
        const node = el.querySelector<HTMLElement>(`[data-testid="anim-${s.key}"]`)
        if (!node) continue
        node.setAttribute('to-fixed', '')
        node.removeAttribute('to-fixed')
        node.setAttribute('value', `${Number(s.value) + Math.floor(Math.random() * 1000)}`)
        node.setAttribute('value', s.value)
        i++
      }
      if (i === 0) void 0
    })
  }

  function rerender(): void {
    stop()
    draw()
    stop = onLocaleChange(rerender)
  }

  draw()
  stop = onLocaleChange(rerender)
  return () => stop()
}
