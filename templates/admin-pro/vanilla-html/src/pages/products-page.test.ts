import { beforeEach, describe, expect, it } from 'vitest'
import { resetProducts } from '../data/products'
import { listProducts } from '../data/products'
import { session } from '../store/session'
import { render } from './products'

async function flush(ms = 120): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

function mount(): HTMLElement {
  const el = document.createElement('main')
  document.body.appendChild(el)
  return el
}

function switchToTable(el: HTMLElement): void {
  const view = el.querySelector<HTMLElement>('[data-testid="product-view"]')!
  view.dispatchEvent(new CustomEvent('oas-change', { detail: { value: 'table' } }))
}

function check(el: HTMLElement, keys: string[]): void {
  const table = el.querySelector<HTMLElement>('[data-testid="product-table"]')!
  table.dispatchEvent(new CustomEvent('oas-check', { detail: { keys } }))
}

function toggleColumn(el: HTMLElement, key: string, checked: boolean): void {
  const cb = el.querySelector<HTMLElement>(`[data-testid="product-columns-${key}"]`)!
  cb.dispatchEvent(
    new CustomEvent('oas-change', { detail: { checked, value: key }, bubbles: true }),
  )
}

function tableColumns(el: HTMLElement): string[] {
  const table = el.querySelector<HTMLElement>('[data-testid="product-table"]')!
  const keys = table.getAttribute('column-keys')
  return keys ? (JSON.parse(keys) as string[]) : []
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetProducts()
  session.login('张伟', 'admin')
  document.body.innerHTML = ''
})

describe('products 页批量操作', () => {
  it('表格带 checkable 与 stripe，批量栏默认隐藏', async () => {
    const el = mount()
    render(el)
    await flush(200)
    const table = el.querySelector<HTMLElement>('[data-testid="product-table"]')!
    expect(table.hasAttribute('checkable')).toBe(true)
    expect(table.hasAttribute('stripe')).toBe(true)
    const bar = el.querySelector<HTMLElement>('[data-testid="product-batch-bar"]')!
    expect(bar.hidden).toBe(true)
  })

  it('oas-check 事件驱动批量栏计数与显隐', async () => {
    const el = mount()
    render(el)
    await flush(200)
    switchToTable(el)
    const bar = el.querySelector<HTMLElement>('[data-testid="product-batch-bar"]')!
    const count = el.querySelector<HTMLElement>('[data-testid="product-batch-count"]')!
    check(el, ['1', '3', '5'])
    expect(bar.hidden).toBe(false)
    expect(count.textContent).toContain('3')
    check(el, [])
    expect(bar.hidden).toBe(true)
  })

  it('卡片视图下选中不显示批量栏', async () => {
    const el = mount()
    render(el)
    await flush(200)
    check(el, ['1', '3', '5'])
    const bar = el.querySelector<HTMLElement>('[data-testid="product-batch-bar"]')!
    expect(bar.hidden).toBe(true)
  })

  it('viewer 角色批量按钮禁用', async () => {
    session.logout()
    session.login('李四', 'viewer')
    const el = mount()
    render(el)
    await flush(200)
    switchToTable(el)
    check(el, ['1'])
    for (const key of ['product-batch-list', 'product-batch-unlist', 'product-batch-delete']) {
      const btn = el.querySelector<HTMLElement>(`[data-testid="${key}"]`)!
      expect(btn.hasAttribute('disabled')).toBe(true)
    }
  })

  it('批量删除经 popconfirm 确认后删除选中行并清空选择', async () => {
    const el = mount()
    render(el)
    await flush(200)
    switchToTable(el)
    check(el, ['1', '2'])
    el.querySelector<HTMLElement>('[data-testid="product-batch-del-pop"]')!.dispatchEvent(
      new Event('oas-ok'),
    )
    await flush(400)
    const rows = await listProducts()
    expect(rows.some((r) => r.id === 1)).toBe(false)
    expect(rows.some((r) => r.id === 2)).toBe(false)
    expect(rows.length).toBe(6)
    const bar = el.querySelector<HTMLElement>('[data-testid="product-batch-bar"]')!
    expect(bar.hidden).toBe(true)
  })

  it('批量上架仅翻转下架项', async () => {
    const el = mount()
    render(el)
    await flush(200)
    switchToTable(el)
    check(el, ['4', '7']) // id4 off, id7 on
    el.querySelector<HTMLElement>('[data-testid="product-batch-list"]')!.dispatchEvent(
      new Event('click'),
    )
    await flush(400)
    const rows = await listProducts()
    expect(rows.find((r) => r.id === 4)?.status).toBe('on')
    expect(rows.find((r) => r.id === 7)?.status).toBe('on')
  })

  it('批量下架仅翻转上架项', async () => {
    const el = mount()
    render(el)
    await flush(200)
    switchToTable(el)
    check(el, ['1', '4']) // id1 on, id4 off
    el.querySelector<HTMLElement>('[data-testid="product-batch-unlist"]')!.dispatchEvent(
      new Event('click'),
    )
    await flush(400)
    const rows = await listProducts()
    expect(rows.find((r) => r.id === 1)?.status).toBe('off')
    expect(rows.find((r) => r.id === 4)?.status).toBe('off')
  })
})

describe('products 页列设置', () => {
  it('列设置按钮打开弹窗并渲染 6 个勾选项', async () => {
    const el = mount()
    render(el)
    await flush(200)
    el.querySelector<HTMLElement>('[data-testid="product-columns"]')!.dispatchEvent(
      new Event('click'),
    )
    const modal = el.querySelector<HTMLElement>('[data-testid="product-columns-modal"]')!
    expect(modal.hasAttribute('visible')).toBe(true)
    const list = el.querySelector<HTMLElement>('[data-testid="product-columns-list"]')!
    const cbs = list.querySelectorAll('oas-checkbox')
    expect(cbs.length).toBe(6)
  })

  it('name 与 action 勾选项禁用且默认选中', async () => {
    const el = mount()
    render(el)
    await flush(200)
    el.querySelector<HTMLElement>('[data-testid="product-columns"]')!.dispatchEvent(
      new Event('click'),
    )
    for (const key of ['name', 'action']) {
      const cb = el.querySelector<HTMLElement>(`[data-testid="product-columns-${key}"]`)!
      expect(cb.hasAttribute('disabled')).toBe(true)
      expect(cb.hasAttribute('checked')).toBe(true)
    }
  })

  it('取消勾选列后表格列集收缩且写入 localStorage', async () => {
    const el = mount()
    render(el)
    await flush(200)
    el.querySelector<HTMLElement>('[data-testid="product-columns"]')!.dispatchEvent(
      new Event('click'),
    )
    toggleColumn(el, 'price', false)
    expect(tableColumns(el)).toEqual(['name', 'category', 'stock', 'status', 'action'])
    expect(JSON.parse(localStorage.getItem('oas-admin.products.columns') ?? '[]')).not.toContain(
      'price',
    )
  })

  it('弹窗重开后勾选状态与持久化一致', async () => {
    const el = mount()
    render(el)
    await flush(200)
    el.querySelector<HTMLElement>('[data-testid="product-columns"]')!.dispatchEvent(
      new Event('click'),
    )
    toggleColumn(el, 'stock', false)
    el.querySelector<HTMLElement>('[data-testid="product-columns-close"]')!.dispatchEvent(
      new Event('click'),
    )
    el.querySelector<HTMLElement>('[data-testid="product-columns"]')!.dispatchEvent(
      new Event('click'),
    )
    const again = el.querySelector<HTMLElement>('[data-testid="product-columns-stock"]')!
    expect(again.hasAttribute('checked')).toBe(false)
  })

  it('恢复默认按钮还原全列并持久化默认', async () => {
    const el = mount()
    render(el)
    await flush(200)
    el.querySelector<HTMLElement>('[data-testid="product-columns"]')!.dispatchEvent(
      new Event('click'),
    )
    toggleColumn(el, 'price', false)
    el.querySelector<HTMLElement>('[data-testid="product-columns-reset"]')!.dispatchEvent(
      new Event('click'),
    )
    expect(tableColumns(el)).toEqual(['name', 'category', 'price', 'stock', 'status', 'action'])
    expect(JSON.parse(localStorage.getItem('oas-admin.products.columns') ?? '[]')).toEqual([
      'name',
      'category',
      'price',
      'stock',
      'status',
      'action',
    ])
  })

  it('强制列不受取消勾选影响', async () => {
    const el = mount()
    render(el)
    await flush(200)
    el.querySelector<HTMLElement>('[data-testid="product-columns"]')!.dispatchEvent(
      new Event('click'),
    )
    toggleColumn(el, 'name', false)
    toggleColumn(el, 'action', false)
    expect(tableColumns(el)).toContain('name')
    expect(tableColumns(el)).toContain('action')
  })
})
