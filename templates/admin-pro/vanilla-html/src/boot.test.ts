import { beforeEach, describe, expect, it } from 'vitest'

describe('app boot', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
  })

  it('渲染 boot 占位视图', async () => {
    await import('./main')
    const view = document.querySelector('#app #view')
    expect(view).not.toBeNull()
    expect(view!.textContent).toContain('boot ok')
  })
})
