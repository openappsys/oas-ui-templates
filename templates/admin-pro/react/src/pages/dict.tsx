// src/pages/dict.tsx —— 字典管理（左类型列表 + 右键值表 + 双弹窗表单）
//    刷文案）；本模版声明式——types/counts/selectedTypeId/editingTypeId/editingItemId/
//    loadedItems/modalOpen 全部 useState，类型列表/pane 标题/空态/弹窗标题全部由 state 派生；
//    useT() 订阅后整页重渲染，rules/labels/placeholders/columns 随 locale 自动重算
// 2. 事件绑定：oas-form 的 oas-submit、oas-modal 的 oas-close、popconfirm 的 oas-ok 走
//    useOasEvent（AGENTS.md 第 1 条）；类型列表点击与表格行内编辑为 light DOM/composed 原生
//    保存按钮按第 2 条例外直绑 addEventListener（panel 对原生事件 stopPropagation）
// 3. columns 含 render 函数（cellAction 返回真实 DOM 节点）→ property 通道（AGENTS.md 第 3 条
//    refreshItems 以显式 typeId 参数避免 React 异步闭包读到旧 selectedTypeId
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TableColumn } from '@oas-ui/ui/data/table'
import '../styles/pages/dict.css'
import {
  createDictItem,
  createDictType,
  listDictItems,
  listDictTypes,
  removeDictItem,
  updateDictItem,
  updateDictType,
} from '../data/system'
import type { DictItem, DictType } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla RULES_TYPE：类型名/编码必填 */
function buildTypeRules(t: TFunc): string {
  return JSON.stringify({
    name: [{ required: true, message: t('dict.rule.typeName') }],
    code: [{ required: true, message: t('dict.rule.typeCode') }],
  })
}

/** vanilla RULES_ITEM：标签/键值必填 */
function buildItemRules(t: TFunc): string {
  return JSON.stringify({
    label: [{ required: true, message: t('dict.rule.label') }],
    value: [{ required: true, message: t('dict.rule.value') }],
  })
}

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

interface FormValues {
  name?: string
  code?: string
  label?: string
  value?: string
  sort?: string
}

export default function DictPage() {
  const { t, locale } = useT()
  const [types, setTypes] = useState<DictType[]>([])
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [loadedItems, setLoadedItems] = useState<DictItem[]>([])
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const savingRef = useRef(false)

  // selectedTypeId 的同步镜像：异步编排里读取当前值（避免 React 闭包旧值）
  const selRef = useRef<number | null>(null)
  selRef.current = selectedTypeId

  const tableRef = useRef<HTMLElement | null>(null)
  const typeModalRef = useRef<HTMLElement | null>(null)
  const itemModalRef = useRef<HTMLElement | null>(null)
  const typeFormRef = useRef<HTMLElement | null>(null)
  const itemFormRef = useRef<HTMLElement | null>(null)
  const typeNameRef = useRef<HTMLElement | null>(null)
  const typeCodeRef = useRef<HTMLElement | null>(null)
  const itemLabelRef = useRef<HTMLElement | null>(null)
  const itemValueRef = useRef<HTMLElement | null>(null)
  const itemSortRef = useRef<HTMLElement | null>(null)
  const typeCancelRef = useRef<HTMLElement | null>(null)
  const typeSaveRef = useRef<HTMLElement | null>(null)
  const itemCancelRef = useRef<HTMLElement | null>(null)
  const itemSaveRef = useRef<HTMLElement | null>(null)

  // vanilla refreshItems：拉选中类型的键值 + 更新计数（显式 typeId 参数，偏差记录 6）
  const refreshItems = useCallback(async (typeId: number | null) => {
    if (typeId == null) {
      setLoadedItems([])
      return
    }
    const items = await listDictItems(typeId)
    setLoadedItems(items)
    setCounts((prev) => ({ ...prev, [typeId]: items.length }))
  }, [])

  // vanilla refresh：全量类型 + 逐类型计数 → refreshItems
  const refresh = useCallback(async () => {
    const rows = await listDictTypes()
    setTypes(rows)
    setSelectedTypeId((prev) =>
      prev != null && rows.some((x) => x.id === prev) ? prev : (rows[0]?.id ?? null),
    )
    const nextSel =
      selRef.current != null && rows.some((x) => x.id === selRef.current)
        ? selRef.current
        : (rows[0]?.id ?? null)
    const nextCounts: Record<number, number> = {}
    await Promise.all(
      rows.map(async (ty) => {
        nextCounts[ty.id] = (await listDictItems(ty.id)).length
      }),
    )
    setCounts(nextCounts)
    await refreshItems(nextSel)
  }, [refreshItems])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectedType = types.find((x) => x.id === selectedTypeId) ?? null
  const editingType = types.find((x) => x.id === editingTypeId) ?? null
  const editingItem = loadedItems.find((x) => x.id === editingItemId) ?? null

  // vanilla openTypeForm/openItemForm：open 边沿逐字段 setAttribute（偏差记录 4）
  useEffect(() => {
    if (!typeModalOpen) return
    typeNameRef.current?.setAttribute('value', editingType?.name ?? '')
    typeCodeRef.current?.setAttribute('value', editingType?.code ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeModalOpen, editingTypeId])

  useEffect(() => {
    if (!itemModalOpen) return
    itemLabelRef.current?.setAttribute('value', editingItem?.label ?? '')
    itemValueRef.current?.setAttribute('value', editingItem?.value ?? '')
    itemSortRef.current?.setAttribute('value', editingItem ? String(editingItem.sort) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemModalOpen, editingItemId])

  // 两个弹窗面板内取消/保存按钮：原生 click 例外直绑（AGENTS.md 第 2 条）
  useEffect(() => {
    const pairs: Array<[HTMLElement | null, HTMLElement | null, HTMLElement | null]> = [
      [typeCancelRef.current, typeSaveRef.current, typeFormRef.current],
      [itemCancelRef.current, itemSaveRef.current, itemFormRef.current],
    ]
    const cleanups: Array<() => void> = []
    for (const [cancel, save, form] of pairs) {
      const onCancel = () => setTypeModalOpen(false)
      const onSave = () => {
        ;(form?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
      }
      cancel?.addEventListener('click', onCancel)
      save?.addEventListener('click', onSave)
      cleanups.push(() => {
        cancel?.removeEventListener('click', onCancel)
        save?.removeEventListener('click', onSave)
      })
    }
    return () => cleanups.forEach((fn) => fn())
  }, [])

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(typeModalRef, 'oas-close', () => setTypeModalOpen(false))
  useOasEvent(itemModalRef, 'oas-close', () => setItemModalOpen(false))

  // vanilla 类型列表 click 段：closest [data-id] → 选中 + refreshItems
  const onTypeListClick = (e: React.MouseEvent) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
    if (!item) return
    const id = Number(item.getAttribute('data-id'))
    setSelectedTypeId(id)
    void refreshItems(id)
  }

  // vanilla 表格 click 段：composedPath 匹配行内编辑按钮（删除由 popconfirm 自驱动）
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

  // vanilla popconfirm oas-ok 段：detail.source 反查 data-del → 删除 → 提示 → refreshItems
  useOasEvent<{ source: HTMLElement }>(tableRef, 'oas-ok', (detail) => {
    const src = detail.source
    if (!src?.hasAttribute?.('data-del')) return
    const id = Number(src.getAttribute('data-del'))
    void removeDictItem(id).then(() => {
      appMessage.success(t('common.deleted'))
      void refreshItems(selRef.current)
    })
  })

  // vanilla typeForm oas-submit 段：trim → create/update → 关闭 + 选中复位 + 全量刷新
  useOasEvent<{ values: FormValues }>(typeFormRef, 'oas-submit', async (d) => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const name = d.values.name?.trim()
      const code = d.values.code?.trim()
      if (!name || !code) return
      if (editingTypeId == null) {
        await createDictType({ name, code })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateDictType(editingTypeId, { name, code })
        if (!updated) appMessage.error(t('dict.notFoundType'))
        else appMessage.success(t('common.saved'))
      }
      setTypeModalOpen(false)
      setSelectedTypeId(null)
      selRef.current = null
      setLoadedItems([])
      void refresh()
    } finally {
      savingRef.current = false
    }
  })

  // vanilla itemForm oas-submit 段：trim → create/update → 关闭 + refreshItems
  useOasEvent<{ values: FormValues }>(itemFormRef, 'oas-submit', async (d) => {
    if (savingRef.current) return
    if (selRef.current == null) return
    savingRef.current = true
    try {
      const label = d.values.label?.trim()
      const value = d.values.value?.trim()
      if (!label || !value) return
      const sort = Number(d.values.sort) || 0
      if (editingItemId == null) {
        await createDictItem({ typeId: selRef.current, label, value, sort })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateDictItem(editingItemId, { label, value, sort })
        if (!updated) appMessage.error(t('dict.notFoundItem'))
        else appMessage.success(t('common.saved'))
      }
      setItemModalOpen(false)
      void refreshItems(selRef.current)
    } finally {
      savingRef.current = false
    }
  })

  // 列定义按 locale 重建（vanilla renderItems 里重设 columns 同款时机）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo<TableColumn[]>(() => buildColumns(t), [locale])

  const typeRules = buildTypeRules(t)
  const itemRules = buildItemRules(t)

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

      <oas-modal ref={typeModalRef} data-testid="dict-type-modal" no-footer visible={typeModalOpen}>
        <div className="modal-body">
          <h2 id="dict-type-title">
            {editingTypeId == null
              ? t('dict.newType')
              : t('dict.editType', { name: editingType?.name ?? '' })}
          </h2>
          <oas-form ref={typeFormRef} rules={typeRules}>
            <div className="dict-form-body">
              <div className="form-field">
                <label className="form-label">
                  {t('dict.form.typeName')} <span className="req">*</span>
                </label>
                <oas-input
                  ref={typeNameRef}
                  data-testid="dtf-name"
                  name="name"
                  placeholder={t('dict.placeholder.typeName')}
                />
              </div>
              <div className="form-field">
                <label className="form-label">
                  {t('dict.form.typeCode')} <span className="req">*</span>
                </label>
                <oas-input
                  ref={typeCodeRef}
                  data-testid="dtf-code"
                  name="code"
                  placeholder={t('dict.placeholder.typeCode')}
                />
              </div>
              <div className="form-actions">
                <oas-space justify="end">
                  <oas-button ref={typeCancelRef} data-testid="dtf-cancel">
                    {t('common.cancel')}
                  </oas-button>
                  <oas-button ref={typeSaveRef} data-testid="dtf-save" type="primary">
                    {t('common.save')}
                  </oas-button>
                </oas-space>
              </div>
            </div>
          </oas-form>
        </div>
      </oas-modal>

      <oas-modal ref={itemModalRef} data-testid="dict-item-modal" no-footer visible={itemModalOpen}>
        <div className="modal-body">
          <h2 id="dict-item-title">
            {editingItemId == null
              ? t('dict.newItem')
              : t('dict.editItem', { label: editingItem?.label ?? '' })}
          </h2>
          <oas-form ref={itemFormRef} rules={itemRules}>
            <div className="dict-form-body">
              <div className="form-field">
                <label className="form-label">
                  {t('dict.form.label')} <span className="req">*</span>
                </label>
                <oas-input
                  ref={itemLabelRef}
                  data-testid="dif-label"
                  name="label"
                  placeholder={t('dict.placeholder.label')}
                />
              </div>
              <div className="form-field">
                <label className="form-label">
                  {t('dict.form.value')} <span className="req">*</span>
                </label>
                <oas-input
                  ref={itemValueRef}
                  data-testid="dif-value"
                  name="value"
                  placeholder={t('dict.placeholder.value')}
                />
              </div>
              <div className="form-field">
                <label className="form-label">{t('dict.form.sort')}</label>
                <oas-input-number
                  ref={itemSortRef}
                  data-testid="dif-sort"
                  name="sort"
                  min="0"
                  placeholder="1"
                />
              </div>
              <div className="form-actions">
                <oas-space justify="end">
                  <oas-button ref={itemCancelRef} data-testid="dif-cancel">
                    {t('common.cancel')}
                  </oas-button>
                  <oas-button ref={itemSaveRef} data-testid="dif-save" type="primary">
                    {t('common.save')}
                  </oas-button>
                </oas-space>
              </div>
            </div>
          </oas-form>
        </div>
      </oas-modal>
    </div>
  )
}
