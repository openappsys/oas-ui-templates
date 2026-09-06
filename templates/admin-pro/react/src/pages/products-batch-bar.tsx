// src/pages/products-batch-bar.tsx —— 商品批量操作栏（表格多选后出现：批量上下架 + 批量删除）
// 行为事实来源：vanilla-html/src/pages/products.ts 的 batchBar 显隐段 / batchStatus / 批量删除
// popconfirm oas-ok 段。
// 偏差记录（因果链）：
// 1. 执行逻辑（toggleProductStatus/removeProduct 循环、clearSelection、appMessage、refresh）
//    留在父组件——它们依赖 rows/selected/refresh；本组件只负责呈现与事件接线
// 2. 事件绑定：上下架按钮在 light DOM，原生 click 用 React onClick；oas-popconfirm 的
//    oas-ok 是自定义事件，走 useOasEvent（AGENTS.md 第 1 条）
// 3. 显隐：vanilla 手动切 hidden；本模版由父组件派生 hidden prop
import { useRef } from 'react'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'

export interface ProductsBatchBarProps {
  /** 卡片视图或无选中项时隐藏 */
  hidden: boolean
  selectedCount: number
  canMutate: boolean
  onBatchStatus: (target: 'on' | 'off') => void
  /** popconfirm 确认删除后回调（父组件执行删除循环 + 提示 + 刷新） */
  onBatchDelete: () => void
}

export function ProductsBatchBar({
  hidden,
  selectedCount,
  canMutate,
  onBatchStatus,
  onBatchDelete,
}: ProductsBatchBarProps) {
  const { t } = useT()
  const delPopRef = useRef<HTMLElement | null>(null)
  const enabled = canMutate && selectedCount > 0

  // 批量删除确认（vanilla popconfirm oas-ok 段；执行体在父组件）
  useOasEvent(delPopRef, 'oas-ok', () => onBatchDelete())

  return (
    <div className="product-batch-bar" data-testid="product-batch-bar" hidden={hidden}>
      <span className="product-batch-count" data-testid="product-batch-count">
        {selectedCount > 0 ? t('products.batch.selected', { count: selectedCount }) : ''}
      </span>
      <oas-space className="product-batch-actions" justify="end">
        <oas-button
          data-testid="product-batch-unlist"
          size="small"
          disabled={!enabled || undefined}
          onClick={() => onBatchStatus('off')}
        >
          {t('products.batch.unlist')}
        </oas-button>
        <oas-button
          data-testid="product-batch-list"
          size="small"
          disabled={!enabled || undefined}
          onClick={() => onBatchStatus('on')}
        >
          {t('products.batch.list')}
        </oas-button>
        <oas-popconfirm
          ref={delPopRef}
          data-testid="product-batch-del-pop"
          id="product-batch-del-pop"
          title={t('products.batch.confirmDelete', { count: selectedCount })}
        >
          <oas-button
            data-testid="product-batch-delete"
            size="small"
            type="danger"
            disabled={!enabled || undefined}
          >
            {t('products.batch.delete')}
          </oas-button>
        </oas-popconfirm>
      </oas-space>
    </div>
  )
}
