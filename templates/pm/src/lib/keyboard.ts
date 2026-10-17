type Handler = (e: KeyboardEvent) => void
interface Entry {
  key: string
  handler: Handler
  when?: () => boolean
}
const entries: Entry[] = []
let bound = false

const TYPING_SELECTOR = 'input, textarea, select, [contenteditable="true"]'

function isTypingTarget(t: EventTarget | null): boolean {
  return !!(t as HTMLElement | null)?.closest?.(TYPING_SELECTOR)
}

function isTypingContext(e: KeyboardEvent): boolean {
  if (isTypingTarget(e.target)) return true
  return e.composedPath().some((n) => n instanceof Element && isTypingTarget(n))
}

function onKey(e: KeyboardEvent) {
  for (const entry of entries) {
    if (e.key !== entry.key) continue
    if (entry.key !== 'Escape' && isTypingContext(e)) continue
    if (entry.when && !entry.when()) continue
    try {
      entry.handler(e)
    } catch (err) {
      console.error('[keyboard]', err)
    }
    if (e.defaultPrevented) return
  }
}

export function isOverlayOpen(): boolean {
  return !!document.querySelector('oas-modal[visible], oas-drawer[visible]')
}

export function bindKeys(): void {
  if (bound) return
  document.addEventListener('keydown', onKey)
  bound = true
}

export function registerKey(key: string, handler: Handler, when?: () => boolean): () => void {
  const entry: Entry = { key, handler, when }
  entries.push(entry)
  return () => {
    const i = entries.indexOf(entry)
    if (i >= 0) entries.splice(i, 1)
  }
}
