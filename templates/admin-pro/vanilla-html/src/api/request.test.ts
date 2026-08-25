import { describe, expect, it, vi } from 'vitest'
import { createHttp } from './request'

function jsonRes(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), { status, ok, headers: { 'Content-Type': 'application/json' } } as ResponseInit)
}

describe('request', () => {
  it('拦截器顺序：请求->响应', async () => {
    const calls: string[] = []
    const http = createHttp({
      interceptors: [
        { onRequest: (c) => { calls.push('req1'); c.url += '?a=1' }, onResponse: (c) => { calls.push('res1') } },
        { onRequest: (c) => { calls.push('req2'); c.headers['X'] = 'y' } },
      ],
    })
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ ok: true }))
    await http.request({ url: '/x', fetchImpl: fetchMock as typeof fetch })
    expect(calls).toEqual(['req1', 'req2', 'res1'])
    expect(String(fetchMock.mock.calls[0][0])).toContain('?a=1')
  })

  it('响应错误拦截器抛错', async () => {
    const http = createHttp({ interceptors: [{ onError: (c) => { c.handled = true; throw new Error('api err') } }] })
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ message: 'bad' }, false, 400))
    await expect(http.request({ url: '/x', fetchImpl: fetchMock as typeof fetch })).rejects.toThrow('api err')
  })

  it('超时触发 AbortController', async () => {
    const http = createHttp({ timeout: 50 })
    let aborted = false
    const fetchMock = vi.fn((_u: string, init?: RequestInit) => {
      return new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener('abort', () => { aborted = true; rej(new DOMException('aborted', 'AbortError')) })
      })
    })
    await expect(http.request({ url: '/x', fetchImpl: fetchMock as typeof fetch })).rejects.toThrow()
    expect(aborted).toBe(true)
  })

  it('GET 拼 query', async () => {
    const http = createHttp({})
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({}))
    await http.request({ url: '/x', params: { p: 1, q: 'a b' }, fetchImpl: fetchMock as typeof fetch })
    expect(String(fetchMock.mock.calls[0][0])).toContain('p=1')
    expect(String(fetchMock.mock.calls[0][0])).toContain('q=a%20b')
  })
})
