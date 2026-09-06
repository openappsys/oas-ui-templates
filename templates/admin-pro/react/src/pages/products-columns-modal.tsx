// src/pages/products-columns-modal.tsx —— 商品列设置弹窗（显隐列 + 偏好持久化）
// 行为事实来源：vanilla-html/src/pages/products.ts 的 columnsModal 段（oas-change 勾选 /
// 重置按钮 / 完成按钮 / writeProductColumns 持久化）。
// 偏差记录（因果链）：
// 1. visible 受控：vanilla 靠组件自闭（遮罩/Esc 时组件自摘 visible 属性）；本模版 visible 由
//    父组件 React state 单一持有，必须监听 oas-close 回写，否则组件自闭后与 state 失同步
// 2. 重置/完成按钮位于 oas-modal panel 内，panel 对原生 click stopPropagation（AGENTS.md
//    第 2 条原生事件例外），与 vanilla 一样在元素上直绑 addEventListener；
//    checkbox 的 oas-change / 弹窗的 oas-close 自定义事件仍走 useOasEvent
// 3. 持久化：勾选/重置后立即 writeProductColumns（与 vanilla 同一时机），列集合经
//    onChange 回写父组件 state 驱动表格 column-keys 重算
import { useEffect, useRef } from 'react'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import {
  PRODUCT_COLUMN_KEYS,
  PRODUCT_COLUMN_MANDATORY,
  writeProductColumns,
} from './product-columns'
import type { ProductColumnKey } from './product-columns'

export interface ProductsColumnsModalProps {
  open: boolean
  columnKeys: ProductColumnKey[]
  /** 勾选/重置后的新列集合（本组件已先行持久化，父组件只负责 setState） */
  onChange: (keys: ProductColumnKey[]) => void
  onClose: () => void
}

export function ProductsColumnsModal({
  open,
  columnKeys,
  onChange,
  onClose,
}: ProductsColumnsModalProps) {
  const { t } = useT()
  const modalRef = useRef<HTMLElement | null>(null)
  const resetRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLElement | null>(null)

  // 回调最新化：panel 内原生监听只在挂载时绑一次（product-form 同款）
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // checkbox 勾选写偏好（vanilla columnsModal oas-change 段；强制列不可取消）
  useOasEvent<{ checked: boolean; value: string }>(modalRef, 'oas-change', (detail) => {
    if (!detail) return
    const key = detail.value as ProductColumnKey
    if (!PRODUCT_COLUMN_KEYS.includes(key) || PRODUCT_COLUMN_MANDATORY.includes(key)) return
    const next = detail.checked
      ? columnKeys.includes(key)
        ? columnKeys
        : [...columnKeys, key]
      : columnKeys.filter((k) => k !== key)
    writeProductColumns(next)
    onChange(next)
  })
  // 组件侧关闭（遮罩/Esc/✕）→ 回写父组件状态（visible 单一事实来源）
  useOasEvent(modalRef, 'oas-close', () => onCloseRef.current())

  // panel 内原生 click 例外直绑：重置=恢复默认并持久化；完成=关闭
  useEffect(() => {
    const reset = resetRef.current
    const close = closeRef.current
    const onReset = () => {
      const next = [...PRODUCT_COLUMN_KEYS]
      writeProductColumns(next)
      onChangeRef.current(next)
    }
    const onDone = () => onCloseRef.current()
    reset?.addEventListener('click', onReset)
    close?.addEventListener('click', onDone)
    return () => {
      reset?.removeEventListener('click', onReset)
      close?.removeEventListener('click', onDone)
    }
  }, [])

  return (
    <oas-modal
      ref={modalRef}
      data-testid="product-columns-modal"
      id="product-columns-modal"
      title={t('products.columns.title')}
      no-footer
      visible={open}
    >
      <div className="product-columns-list" data-testid="product-columns-list">
        {PRODUCT_COLUMN_KEYS.map((key) => {
          const title = key === 'category' ? t('products.category') : t(`products.th.${key}`)
          const mandatory = PRODUCT_COLUMN_MANDATORY.includes(key)
          return (
            <label key={key} className="product-column-check">
              <oas-checkbox
                data-testid={`product-columns-${key}`}
                value={key}
                checked={mandatory || columnKeys.includes(key) || undefined}
                disabled={mandatory || undefined}
              >
                {title}
              </oas-checkbox>
            </label>
          )
        })}
      </div>
      <div className="form-actions">
        <oas-space justify="end">
          <oas-button ref={resetRef} data-testid="product-columns-reset">
            {t('products.columns.reset')}
          </oas-button>
          <oas-button ref={closeRef} data-testid="product-columns-close" type="primary">
            {t('common.save')}
          </oas-button>
        </oas-space>
      </div>
    </oas-modal>
  )
}
