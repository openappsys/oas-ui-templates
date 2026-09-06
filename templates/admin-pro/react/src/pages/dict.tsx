// src/pages/dict.tsx —— 字典管理（左类型列表 + 右键值表 + 双弹窗表单）
// 1. 数据：类型列表/键值计数/选中类型条目三路走 TanStack Query（useDictTypes/useDictCounts/
//    useDictItems），选中类型由 state 与类型集合派生（类型被删回落第一个）；
//    labels/placeholders/columns 随 locale 自动重算
// 2. 事件绑定：类型列表点击与表格行内编辑为 light DOM/composed 原生 click；表格行删除
//    popconfirm 的 oas-ok 走 useOasEvent；弹窗表单事件见 ./dict-type-modal.tsx、
//    ./dict-item-modal.tsx（各自关闭各自的弹窗）
// 3. columns 含 render 函数（cellAction 返回真实 DOM 节点）→ property 通道
// 4. CRUD 全部走 useDictMutations：成功后失效字典域缓存，计数/条目/列表联动重取
import { useMemo, useRef, useState } from 'react'
import type { TableColumn } from '@oas-ui/ui/data/table'
import './dict.css'
import type { DictItem } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useDictCounts, useDictItems, useDictMutations, useDictTypes } from '../hooks/use-system'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { DictItemModal } from './dict-item-modal'
import type { DictItemFormValues } from './dict-item-modal'
import { DictTypeModal } from './dict-type-modal'
import type { DictTypeFormValues } from './dict-type-modal'

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla itemActionCell：编辑按钮 + popconfirm 包裹的删除按钮 */
function itemActionCell(item: DictItem, t: TFunc): HTMLElement {
  const ctx = document.createElement('div')
  ctx.className = 'action-cell'
  const edit = document.createElement('oas-button')
  edit.setAttribute('data-edit', String(item.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('type', 'text')
  edit.textContent = t('common.edit')
  const pop = document.createElement('oas-popconfirm')
  pop.setAttribute('data-del', String(item.id))
  pop.setAttribute('title', t('dict.confirmDeleteItem'))
  const del = document.createElement('oas-button')
  del.setAttribute('size', 'small')
  del.setAttribute('type', 'danger')
  del.textContent = t('common.delete')
  pop.appendChild(del)
  ctx.appendChild(edit)
  ctx.appendChild(pop)
  return ctx
}

/** vanilla ITEM_COLUMNS */
function buildColumns(t: TFunc): TableColumn[] {
  return [
    { key: 'label', title: t('dict.th.label') },
    { key: 'value', title: t('dict.th.value') },
    { key: 'sort', title: t('dict.th.sort'), align: 'right' },
    {
      key: 'action',
      title: t('dict.th.action'),
      render: (r) => itemActionCell(r as unknown as DictItem, t),
    },
  ]
}

export default function DictPage() {
  const { t, locale } = useT()
  const [selectedState, setSelectedState] = useState<number | null>(null)
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const savingRef = useRef(false)

  const tableRef = useRef<HTMLElement | null>(null)

  // 三路数据：类型列表 / 各类型条目计数 / 选中类型的条目
  const { data: typesData } = useDictTypes()
  const types = typesData ?? []
  const counts = useDictCounts(types).data ?? {}
  // 选中类型派生：state 里选中的仍存在则用之，否则回落第一个（类型删除后自动纠偏）
  const selectedTypeId =
    selectedState != null && types.some((x) => x.id === selectedState)
      ? selectedState
      : (types[0]?.id ?? null)
  const loadedItems = useDictItems(selectedTypeId).data ?? []

  const mutations = useDictMutations()

  const selectedType = types.find((x) => x.id === selectedTypeId) ?? null
  const editingType = types.find((x) => x.id === editingTypeId) ?? null
  const editingItem = loadedItems.find((x) => x.id === editingItemId) ?? null

  const onTypeListClick = (e: React.MouseEvent) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
    if (!item) return
    setSelectedState(Number(item.getAttribute('data-id')))
  }

  const onTableWrapClick = (e: React.MouseEvent) => {
    const btn = e.nativeEvent
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-edit]'))
    if (!btn) return
    const item = loadedItems.find((d) => d.id === Number(btn.getAttribute('data-edit')))
    if (item) {
      setEditingItemId(item.id)
      setItemModalOpen(true)
    }
  }

  useOasEvent<{ source: HTMLElement }>(tableRef, 'oas-ok', (detail) => {
    const src = detail.source
    if (!src?.hasAttribute?.('data-del')) return
    const id = Number(src.getAttribute('data-del'))
    void (async () => {
      await mutations.removeItem.mutateAsync(id)
      appMessage.success(t('common.deleted'))
    })()
  })

  // 类型弹窗提交（经 type 弹窗的 oas-submit 转发）：trim → create/update → 关闭 + 选中复位
  // （失效重取后按派生逻辑回落第一个类型）
  const handleTypeSubmit = async (values: DictTypeFormValues) => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const name = values.name?.trim()
      const code = values.code?.trim()
      if (!name || !code) return
      if (editingTypeId == null) {
        await mutations.createType.mutateAsync({ name, code })
        appMessage.success(t('common.created'))
      } else {
        const updated = await mutations.updateType.mutateAsync({
          id: editingTypeId,
          data: { name, code },
        })
        if (!updated) appMessage.error(t('dict.notFoundType'))
        else appMessage.success(t('common.saved'))
      }
      setTypeModalOpen(false)
      setSelectedState(null)
    } finally {
      savingRef.current = false
    }
  }

  // 键值弹窗提交（经 item 弹窗的 oas-submit 转发）：trim → create/update → 关闭（失效自动重取）
  const handleItemSubmit = async (values: DictItemFormValues) => {
    if (savingRef.current) return
    if (selectedTypeId == null) return
    savingRef.current = true
    try {
      const label = values.label?.trim()
      const value = values.value?.trim()
      if (!label || !value) return
      const sort = Number(values.sort) || 0
      if (editingItemId == null) {
        await mutations.createItem.mutateAsync({ typeId: selectedTypeId, label, value, sort })
        appMessage.success(t('common.created'))
      } else {
        const updated = await mutations.updateItem.mutateAsync({
          id: editingItemId,
          data: { label, value, sort },
        })
        if (!updated) appMessage.error(t('dict.notFoundItem'))
        else appMessage.success(t('common.saved'))
      }
      setItemModalOpen(false)
    } finally {
      savingRef.current = false
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo<TableColumn[]>(() => buildColumns(t), [locale])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.dict')}</h1>
          <p className="page-subtitle">{t('dict.subtitle')}</p>
        </div>
      </div>
      <div className="dict-layout">
        <oas-card className="dict-type-card" title={t('dict.typeTitle')}>
          <div className="dict-type-list" data-testid="dict-type-list" onClick={onTypeListClick}>
            {types.length === 0 ? (
              <div className="dict-empty">{t('dict.empty.types')}</div>
            ) : (
              types.map((ty) => (
                <div
                  key={ty.id}
                  className={`dict-type-item${ty.id === selectedTypeId ? ' is-selected' : ''}`}
                  data-id={ty.id}
                  data-testid="dict-type-item"
                >
                  <span className="dict-type-name">{ty.name}</span>
                  <span className="dict-type-code mono">{ty.code}</span>
                  <span className="dict-type-count">{counts[ty.id] ?? 0}</span>
                </div>
              ))
            )}
          </div>
        </oas-card>
        <oas-card className="dict-items-card" title={t('dict.itemTitle')}>
          <div className="dict-pane-head" id="dict-pane-head">
            <div id="dict-pane-title">
              <span className="dict-pane-title">
                {selectedType ? selectedType.name : t('dict.itemTitle')}
              </span>
              <div className="dict-pane-sub">
                {selectedType
                  ? t('dict.itemCount', {
                      code: selectedType.code,
                      count: counts[selectedType.id] ?? 0,
                    })
                  : t('dict.empty.selectType')}
              </div>
            </div>
            <div>
              <oas-button
                data-testid="dict-type-create"
                type="text"
                icon="plus"
                onClick={() => {
                  setEditingTypeId(null)
                  setTypeModalOpen(true)
                }}
              >
                {t('dict.newType')}
              </oas-button>
              <oas-button
                data-testid="dict-item-create"
                type="primary"
                icon="plus"
                onClick={() => {
                  if (selectedTypeId == null) {
                    appMessage.warning(t('dict.warn.selectType'))
                    return
                  }
                  setEditingItemId(null)
                  setItemModalOpen(true)
                }}
              >
                {t('dict.newItem')}
              </oas-button>
            </div>
          </div>
          <div
            id="dict-items-wrap"
            hidden={selectedTypeId == null || undefined}
            className={loadedItems.length === 0 ? 'table-hidden' : undefined}
            onClick={onTableWrapClick}
          >
            <oas-table
              ref={tableRef}
              data-testid="dict-items-table"
              row-key="id"
              columns={columns}
              data={JSON.stringify(loadedItems)}
            />
          </div>
        </oas-card>
      </div>

      {/* 两个弹窗各自管理自己的关闭/提交接线（type 关 type、item 关 item） */}
      <DictTypeModal
        open={typeModalOpen}
        editing={editingType}
        onClose={() => setTypeModalOpen(false)}
        onSubmit={(values) => void handleTypeSubmit(values)}
      />
      <DictItemModal
        open={itemModalOpen}
        editing={editingItem}
        onClose={() => setItemModalOpen(false)}
        onSubmit={(values) => void handleItemSubmit(values)}
      />
    </div>
  )
}
