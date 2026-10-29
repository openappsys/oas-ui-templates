type Handler = (e: KeyboardEvent) => void
interface Entry {
  key: string
  handler: Handler
  when?: () => boolean
  mod?: boolean
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

function hasCommandModifier(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey
}

function onKey(e: KeyboardEvent) {
  // 编辑态已消费的键（如标题就地编辑的 Esc 取消）不再触发全局快捷键：
  // React 委托在 #root 先于 document 冒泡，preventDefault 即「已处理」标记
  if (e.defaultPrevented) return
  for (const entry of entries) {
    if (e.key !== entry.key) continue
    if (entry.mod ? !hasCommandModifier(e) : hasCommandModifier(e)) continue
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

export function registerKey(
  key: string,
  handler: Handler,
  when?: () => boolean,
  opts?: { mod?: boolean },
): () => void {
  const entry: Entry = { key, handler, when, mod: opts?.mod }
  entries.push(entry)
  return () => {
    const i = entries.indexOf(entry)
    if (i >= 0) entries.splice(i, 1)
  }
}
