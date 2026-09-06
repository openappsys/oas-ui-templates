import { beforeEach, describe, expect, it } from 'vitest'
import {
  PRODUCT_COLUMN_KEYS,
  PRODUCT_COLUMN_MANDATORY,
  readProductColumns,
  writeProductColumns,
} from './product-columns'
import type { ProductColumnKey } from './product-columns'

const KEY = 'oas-admin.products.columns'

beforeEach(() => {
  localStorage.clear()
})

describe('product-columns 列可见性偏好', () => {
  it('默认返回全部 6 列', () => {
    expect(readProductColumns()).toEqual(PRODUCT_COLUMN_KEYS)
  })

  it('无存储时名/操作两列为强制列', () => {
    expect(PRODUCT_COLUMN_MANDATORY).toEqual(['name', 'action'])
  })

  it('存储子集按声明顺序返回并补齐强制列', () => {
    localStorage.setItem(KEY, JSON.stringify(['price', 'stock', 'category']))
    expect(readProductColumns()).toEqual(['category', 'price', 'stock', 'name', 'action'])
  })

  it('存储含未知 key 时丢弃未知项', () => {
    localStorage.setItem(KEY, JSON.stringify(['name', 'foo' as string, 'price']))
    expect(readProductColumns()).toEqual(['name', 'price', 'action'])
  })

  it('存储为空数组时回退默认全部列', () => {
    localStorage.setItem(KEY, JSON.stringify([]))
    expect(readProductColumns()).toEqual(PRODUCT_COLUMN_KEYS)
  })

  it('存储为非法 JSON 时回退默认全部列', () => {
    localStorage.setItem(KEY, 'not-json')
    expect(readProductColumns()).toEqual(PRODUCT_COLUMN_KEYS)
  })

  it('writeProductColumns 剔除未知 key 并持久化', () => {
    writeProductColumns(['stock', 'foo', 'status'] as ProductColumnKey[])
    expect(readProductColumns()).toEqual(['name', 'stock', 'status', 'action'])
  })

  it('writeProductColumns 强制列缺失时自动补齐且去重', () => {
    writeProductColumns(['action', 'action', 'price'])
    expect(readProductColumns()).toEqual(['name', 'price', 'action'])
  })
})
