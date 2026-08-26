import { beforeEach, describe, expect, it } from 'vitest'

describe('app shell', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
  })

  it('挂载外壳（侧栏/顶栏/内容区）', async () => {
    await import('./main')
    const root = document.querySelector<HTMLDivElement>('#app')!
    expect(root.querySelector('#nav')).not.toBeNull()
    expect(root.querySelector('#view')).not.toBeNull()
    expect(root.querySelector('#theme-toggle')).not.toBeNull()
    expect(root.querySelector('.oas-logo-word')?.textContent).toBe('OAS Admin Pro')
  })
})
