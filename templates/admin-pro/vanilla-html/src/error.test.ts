import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reportError, setErrorReporter } from './error'
import type { ErrorReport } from './error'

describe('error 上报', () => {
  const reports: ErrorReport[] = []
  beforeEach(() => {
    reports.length = 0
    setErrorReporter((r) => reports.push(r))
  })

  it('reportError 生成带 context/stack 的报告并交给 reporter', () => {
    const err = new Error('boom')
    reportError(err, 'router-render', { path: '/users' })
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      message: 'boom',
      context: 'router-render',
      detail: { path: '/users' },
    })
    expect(reports[0].stack).toContain('Error: boom')
    expect(typeof reports[0].timestamp).toBe('number')
  })

  it('非 Error 值也转为消息', () => {
    reportError('plain string', 'page')
    expect(reports[0]?.message).toBe('plain string')
    expect(reports[0]?.stack).toBeUndefined()
  })

  it('setErrorReporter(null) 恢复默认 console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setErrorReporter(null)
    reportError(new Error('x'), 'unknown')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
