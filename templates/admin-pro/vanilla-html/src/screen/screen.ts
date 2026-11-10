export function renderScreen(el: HTMLElement): () => void {
  el.textContent = 'screen placeholder'
  return () => {}
}
