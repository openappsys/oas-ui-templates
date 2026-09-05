import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { useOasEvent } from './use-oas-event'

// vitest 未开启 globals，RTL 的自动 cleanup 不会注册，需手动清理
afterEach(cleanup)

type SubmitDetail = { values: Record<string, string> }

function Probe({ onSubmit }: { onSubmit: (detail: SubmitDetail, ev: Event) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useOasEvent<SubmitDetail>(ref, 'oas-submit', onSubmit)
  return <div ref={ref} data-testid="target" />
}

describe('useOasEvent', () => {
  it('挂载后收到自定义事件并正确传递 detail', () => {
    const spy = vi.fn()
    render(<Probe onSubmit={spy} />)
    const el = screen.getByTestId('target')
    el.dispatchEvent(new CustomEvent('oas-submit', { detail: { values: { a: '1' } } }))
    expect(spy).toHaveBeenCalledTimes(1)
    const [detail, ev] = spy.mock.calls[0] as [SubmitDetail, Event]
    expect(detail.values.a).toBe('1')
    expect(ev).toBeInstanceOf(Event)
    expect(ev.type).toBe('oas-submit')
  })

  it('卸载后 cleanup 生效，再 dispatch 不再触发', () => {
    const spy = vi.fn()
    const { unmount } = render(<Probe onSubmit={spy} />)
    const el = screen.getByTestId('target')
    unmount()
    el.dispatchEvent(new CustomEvent('oas-submit', { detail: { values: { a: '1' } } }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('handler 变化不重复解绑，且总是调用最新 handler', () => {
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    const { rerender } = render(<Probe onSubmit={spy1} />)
    const el = screen.getByTestId('target')
    rerender(<Probe onSubmit={spy2} />)
    el.dispatchEvent(new CustomEvent('oas-submit', { detail: { values: { a: '2' } } }))
    expect(spy1).not.toHaveBeenCalled()
    expect(spy2).toHaveBeenCalledTimes(1)
    expect((spy2.mock.calls[0] as [SubmitDetail, Event])[0].values.a).toBe('2')
  })
})
