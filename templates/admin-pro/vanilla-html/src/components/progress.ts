let root: HTMLElement | null = null
let bar: HTMLElement | null = null
let value = 0
let timer: number | undefined

function ensure(): HTMLElement {
  if (root && root.isConnected) return root
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
  root = document.createElement('div')
  root.className = 'oas-progress'
  root.setAttribute('aria-hidden', 'true')
  bar = document.createElement('div')
  bar.className = 'oas-progress-bar'
  root.appendChild(bar)
  document.body.appendChild(root)
  return root
}

function tick(): void {
  value += (0.9 - value) * 0.18
  if (value >= 0.9) value = 0.9
  bar!.style.width = `${Math.round(value * 100)}%`
}

export const progress = {
  start(): void {
    const el = ensure()
    if (el.classList.contains('is-active')) return
    bar!.style.transition = 'none'
    bar!.style.width = '0%'
    void el.getBoundingClientRect()
    bar!.style.transition = ''
    el.classList.add('is-active')
    value = 0.08
    bar!.style.width = '8%'
    if (timer === undefined) timer = window.setInterval(tick, 240)
  },

  done(): void {
    if (!root || !root.classList.contains('is-active')) return
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
    bar!.style.width = '100%'
    root.classList.remove('is-active')
  },
}
