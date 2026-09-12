import { describe, expect, it } from 'vitest'
import { guard } from './guard'
import type { User } from '../store/session'

const admin: User = { name: '管理员', role: 'admin' }
const viewer: User = { name: '访客', role: 'viewer' }

describe('guard', () => {
  it('未登录访问受限页面 → login', () => {
    expect(guard('/dashboard', null)).toEqual({ ok: false, reason: 'login' })
  })

  it('已登录访问不存在路径 → not-found', () => {
    expect(guard('/nope', admin)).toEqual({ ok: false, reason: 'not-found' })
  })

  it('viewer 访问 roles [admin] 的 /products → forbidden', () => {
    expect(guard('/products', viewer)).toEqual({ ok: false, reason: 'forbidden' })
  })

  it('admin 访问 /products → ok', () => {
    expect(guard('/products', admin)).toEqual({ ok: true, path: '/products' })
  })
})
