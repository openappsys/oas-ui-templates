import { message } from '@oas-ui/ui/feedback/message'
import type { OASTable, TableColumn } from '@oas-ui/ui/data/table'
import { onLocaleChange, t } from '../i18n'
import {
  createDictItem,
  createDictType,
  listDictItems,
  listDictTypes,
  removeDictItem,
  removeDictType,
  updateDictItem,
  updateDictType,
} from '../data/system'
import type { DictItem, DictType } from '../data/system'
import '../styles/pages/dict.css'

const RULES_TYPE = (): string =>
  JSON.stringify({
    name: [{ required: true, message: t('dict.rule.typeName') }],
    code: [{ required: true, message: t('dict.rule.typeCode') }],
  })

const RULES_ITEM = (): string =>
  JSON.stringify({
    label: [{ required: true, message: t('dict.rule.label') }],
    value: [{ required: true, message: t('dict.rule.value') }],
  })

function itemActionCell(item: DictItem): HTMLElement {
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

const ITEM_COLUMNS = (): TableColumn[] => [
  { key: 'label', title: t('dict.th.label') },
  { key: 'value', title: t('dict.th.value') },
  { key: 'sort', title: t('dict.th.sort'), align: 'right' },
  {
    key: 'action',
    title: t('dict.th.action'),
    render: (r) => itemActionCell(r as unknown as DictItem),
  },
]

interface PageState {
  types: DictType[]
  counts: Record<number, number>
  selectedTypeId: number | null
  editingTypeId: number | null
  editingItemId: number | null
  loadedItems: DictItem[]
}

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    types: [],
    counts: {},
    selectedTypeId: null,
    editingTypeId: null,
    editingItemId: null,
    loadedItems: [],
  }
  let saving = false

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('nav.dict')}</h1>
          <p class="page-subtitle">${t('dict.subtitle')}</p>
        </div>
      </div>
      <div class="dict-layout">
        <oas-card class="dict-type-card" title="${t('dict.typeTitle')}">
          <div class="dict-type-list" data-testid="dict-type-list"></div>
        </oas-card>
        <oas-card class="dict-items-card" title="${t('dict.itemTitle')}">
          <div class="dict-pane-head" id="dict-pane-head">
            <div id="dict-pane-title"></div>
            <div>
              <oas-button data-testid="dict-type-create" type="text" icon="plus">${t('dict.newType')}</oas-button>
              <oas-button data-testid="dict-item-create" type="primary" icon="plus">${t('dict.newItem')}</oas-button>
            </div>
          </div>
          <div id="dict-items-wrap">
            <oas-table data-testid="dict-items-table" row-key="id"></oas-table>
          </div>
        </oas-card>
      </div>

      <oas-modal data-testid="dict-type-modal" no-footer>
        <div class="modal-body">
          <h2 id="dict-type-title">${t('dict.newType')}</h2>
          <oas-form id="dict-type-form" rules='${RULES_TYPE()}'>
            <div class="dict-form-body">
              <div class="form-field">
                <label class="form-label">${t('dict.form.typeName')} <span class="req">*</span></label>
                <oas-input data-testid="dtf-name" name="name" placeholder="${t('dict.placeholder.typeName')}"></oas-input>
              </div>
              <div class="form-field">
                <label class="form-label">${t('dict.form.typeCode')} <span class="req">*</span></label>
                <oas-input data-testid="dtf-code" name="code" placeholder="${t('dict.placeholder.typeCode')}"></oas-input>
              </div>
              <div class="form-actions">
                <oas-space justify="end">
                  <oas-button data-testid="dtf-cancel">${t('common.cancel')}</oas-button>
                  <oas-button data-testid="dtf-save" type="primary">${t('common.save')}</oas-button>
                </oas-space>
              </div>
            </div>
          </oas-form>
        </div>
      </oas-modal>

      <oas-modal data-testid="dict-item-modal" no-footer>
        <div class="modal-body">
          <h2 id="dict-item-title">${t('dict.newItem')}</h2>
          <oas-form id="dict-item-form" rules='${RULES_ITEM()}'>
            <div class="dict-form-body">
              <div class="form-field">
                <label class="form-label">${t('dict.form.label')} <span class="req">*</span></label>
                <oas-input data-testid="dif-label" name="label" placeholder="${t('dict.placeholder.label')}"></oas-input>
              </div>
              <div class="form-field">
                <label class="form-label">${t('dict.form.value')} <span class="req">*</span></label>
                <oas-input data-testid="dif-value" name="value" placeholder="${t('dict.placeholder.value')}"></oas-input>
              </div>
              <div class="form-field">
                <label class="form-label">${t('dict.form.sort')}</label>
                <oas-input-number data-testid="dif-sort" name="sort" min="0" placeholder="1"></oas-input-number>
              </div>
              <div class="form-actions">
                <oas-space justify="end">
                  <oas-button data-testid="dif-cancel">${t('common.cancel')}</oas-button>
                  <oas-button data-testid="dif-save" type="primary">${t('common.save')}</oas-button>
                </oas-space>
              </div>
            </div>
          </oas-form>
        </div>
      </oas-modal>
    </div>`

  const typeList = el.querySelector<HTMLElement>('[data-testid="dict-type-list"]')!
  const itemTable = el.querySelector<OASTable>('[data-testid="dict-items-table"]')!
  const itemWrap = el.querySelector<HTMLElement>('#dict-items-wrap')!
  const paneTitle = el.querySelector<HTMLElement>('#dict-pane-title')!
  const typeModal = el.querySelector<HTMLElement>('[data-testid="dict-type-modal"]')!
  const itemModal = el.querySelector<HTMLElement>('[data-testid="dict-item-modal"]')!
  const typeForm = el.querySelector<HTMLElement>('#dict-type-form')!
  const itemForm = el.querySelector<HTMLElement>('#dict-item-form')!

  function openModal(target: HTMLElement): void {
    target.setAttribute('visible', '')
  }
  function closeModal(target: HTMLElement): void {
    target.removeAttribute('visible')
  }

  function renderTypeList(): void {
    if (state.types.length === 0) {
      typeList.innerHTML = `<div class="dict-empty">${t('dict.empty.types')}</div>`
      return
    }
    typeList.innerHTML = state.types
      .map(
        (
          t,
        ) => `<div class="dict-type-item${t.id === state.selectedTypeId ? ' is-selected' : ''}" data-id="${t.id}" data-testid="dict-type-item">
          <span class="dict-type-name">${t.name}</span>
          <span class="dict-type-code mono">${t.code}</span>
          <span class="dict-type-count">${state.counts[t.id] ?? 0}</span>
        </div>`,
      )
      .join('')
  }

  function renderItems(): void {
    const type = state.types.find((t) => t.id === state.selectedTypeId)
    if (!type) {
      paneTitle.innerHTML = `<span class="dict-pane-title">${t('dict.itemTitle')}</span><div class="dict-pane-sub">${t('dict.empty.selectType')}</div>`
      itemWrap.hidden = true
      return
    }
    paneTitle.innerHTML = `<span class="dict-pane-title">${type.name}</span><div class="dict-pane-sub">${t('dict.itemCount', { code: type.code, count: state.counts[type.id] ?? 0 })}</div>`
    itemWrap.hidden = false
    if (!state.loadedItems) return
    const items = state.loadedItems
    itemTable.columns = ITEM_COLUMNS()
    itemTable.setAttribute('data', JSON.stringify(items))
    itemWrap.classList.toggle('table-hidden', items.length === 0)
  }

  function onItemClick(e: Event): void {
    const path = e.composedPath() as HTMLElement[]
    const editBtn = path.find((n) => n.matches?.('[data-edit]'))
    if (editBtn) {
      const id = Number(editBtn.getAttribute('data-edit'))
      const item = state.loadedItems.find((d) => d.id === id)
      if (item) openItemForm(item)
      return
    }
    // v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动，无需模板手动 open
  }

  function onItemDelete(e: Event): void {
    // v2.2.8 起 popconfirm 的 ok/cancel 事件带 detail.source，直接反查来源
    const pc = (e as CustomEvent<{ source: HTMLElement }>).detail.source
    if (!pc?.hasAttribute?.('data-del')) return
    const id = Number(pc.getAttribute('data-del'))
    void removeDictItem(id).then(() => {
      message.success(t('common.deleted'))
      void refreshItems()
    })
  }

  async function refreshItems(): Promise<void> {
    if (state.selectedTypeId == null) {
      state.loadedItems = []
      renderItems()
      return
    }
    state.loadedItems = await listDictItems(state.selectedTypeId)
    state.counts[state.selectedTypeId] = state.loadedItems.length
    renderTypeList()
    renderItems()
  }

  function openTypeForm(type: DictType | null): void {
    state.editingTypeId = type?.id ?? null
    el.querySelector<HTMLElement>('[data-testid="dtf-name"]')!.setAttribute(
      'value',
      type?.name ?? '',
    )
    el.querySelector<HTMLElement>('[data-testid="dtf-code"]')!.setAttribute(
      'value',
      type?.code ?? '',
    )
    el.querySelector<HTMLElement>('#dict-type-title')!.textContent = type
      ? t('dict.editType', { name: type.name })
      : t('dict.newType')
    openModal(typeModal)
  }

  function openItemForm(item: DictItem | null): void {
    if (state.selectedTypeId == null) return
    state.editingItemId = item?.id ?? null
    el.querySelector<HTMLElement>('[data-testid="dif-label"]')!.setAttribute(
      'value',
      item?.label ?? '',
    )
    el.querySelector<HTMLElement>('[data-testid="dif-value"]')!.setAttribute(
      'value',
      item?.value ?? '',
    )
    el.querySelector<HTMLElement>('[data-testid="dif-sort"]')!.setAttribute(
      'value',
      item ? String(item.sort) : '',
    )
    el.querySelector<HTMLElement>('#dict-item-title')!.textContent = item
      ? t('dict.editItem', { label: item.label })
      : t('dict.newItem')
    openModal(itemModal)
  }

  async function refresh(): Promise<void> {
    state.types = await listDictTypes()
    if (state.selectedTypeId == null || !state.types.some((t) => t.id === state.selectedTypeId)) {
      state.selectedTypeId = state.types[0]?.id ?? null
    }
    state.loadedItems = []
    await Promise.all(
      state.types.map(async (t) => {
        state.counts[t.id] = (await listDictItems(t.id)).length
      }),
    )
    renderTypeList()
    await refreshItems()
  }

  typeList.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
    if (!item) return
    state.selectedTypeId = Number(item.getAttribute('data-id'))
    renderTypeList()
    void refreshItems()
  })

  el.querySelector<HTMLElement>('[data-testid="dict-type-create"]')!.addEventListener(
    'click',
    () => {
      openTypeForm(null)
    },
  )

  el.querySelector<HTMLElement>('[data-testid="dict-item-create"]')!.addEventListener(
    'click',
    () => {
      if (state.selectedTypeId == null) {
        message.warning(t('dict.warn.selectType'))
        return
      }
      openItemForm(null)
    },
  )

  el.querySelector<HTMLElement>('[data-testid="dtf-cancel"]')!.addEventListener('click', () =>
    closeModal(typeModal),
  )
  el.querySelector<HTMLElement>('[data-testid="dif-cancel"]')!.addEventListener('click', () =>
    closeModal(itemModal),
  )

  el.querySelector<HTMLElement>('[data-testid="dtf-save"]')!.addEventListener('click', () => {
    ;(typeForm.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })
  el.querySelector<HTMLElement>('[data-testid="dif-save"]')!.addEventListener('click', () => {
    ;(itemForm.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  typeForm.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = (e as CustomEvent<{ values: { name: string; code: string } }>).detail.values
      const name = values.name?.trim()
      const code = values.code?.trim()
      if (!name || !code) return
      if (state.editingTypeId == null) {
        await createDictType({ name, code })
        message.success(t('common.created'))
      } else {
        const updated = await updateDictType(state.editingTypeId, { name, code })
        if (!updated) message.error(t('dict.notFoundType'))
        else message.success(t('common.saved'))
      }
      closeModal(typeModal)
      state.selectedTypeId = null
      state.loadedItems = []
      void refresh()
    } finally {
      saving = false
    }
  })

  itemForm.addEventListener('oas-submit', async (e) => {
    if (saving) return
    if (state.selectedTypeId == null) return
    saving = true
    try {
      const values = (e as CustomEvent<{ values: { label: string; value: string; sort: string } }>)
        .detail.values
      const label = values.label?.trim()
      const value = values.value?.trim()
      if (!label || !value) return
      const sort = Number(values.sort) || 0
      if (state.editingItemId == null) {
        await createDictItem({ typeId: state.selectedTypeId, label, value, sort })
        message.success(t('common.created'))
      } else {
        const updated = await updateDictItem(state.editingItemId, { label, value, sort })
        if (!updated) message.error(t('dict.notFoundItem'))
        else message.success(t('common.saved'))
      }
      closeModal(itemModal)
      void refreshItems()
    } finally {
      saving = false
    }
  })

  itemTable.addEventListener('click', onItemClick)
  itemTable.addEventListener('oas-ok', onItemDelete)

  function refreshText(): void {
    el.querySelector<HTMLElement>('h1.page-title')!.textContent = t('nav.dict')
    el.querySelector<HTMLElement>('p.page-subtitle')!.textContent = t('dict.subtitle')
    el.querySelector<HTMLElement>('.dict-type-card')!.setAttribute('title', t('dict.typeTitle'))
    el.querySelector<HTMLElement>('.dict-items-card')!.setAttribute('title', t('dict.itemTitle'))
    el.querySelector<HTMLElement>('[data-testid="dict-type-create"]')!.textContent =
      t('dict.newType')
    el.querySelector<HTMLElement>('[data-testid="dict-item-create"]')!.textContent =
      t('dict.newItem')
    // 类型弹窗
    const editingType = state.types.find((x) => x.id === state.editingTypeId)
    el.querySelector<HTMLElement>('#dict-type-title')!.textContent = editingType
      ? t('dict.editType', { name: editingType.name })
      : t('dict.newType')
    el.querySelector<HTMLElement>('[data-testid="dtf-name"]')!.setAttribute(
      'placeholder',
      t('dict.placeholder.typeName'),
    )
    el.querySelector<HTMLElement>('[data-testid="dtf-code"]')!.setAttribute(
      'placeholder',
      t('dict.placeholder.typeCode'),
    )
    el.querySelector<HTMLElement>('#dict-type-form')!.setAttribute('rules', RULES_TYPE())
    el.querySelector<HTMLElement>('[data-testid="dtf-cancel"]')!.textContent = t('common.cancel')
    el.querySelector<HTMLElement>('[data-testid="dtf-save"]')!.textContent = t('common.save')
    // 键值弹窗
    const editingItem = state.loadedItems.find((x) => x.id === state.editingItemId)
    el.querySelector<HTMLElement>('#dict-item-title')!.textContent = editingItem
      ? t('dict.editItem', { label: editingItem.label })
      : t('dict.newItem')
    el.querySelector<HTMLElement>('[data-testid="dif-label"]')!.setAttribute(
      'placeholder',
      t('dict.placeholder.label'),
    )
    el.querySelector<HTMLElement>('[data-testid="dif-value"]')!.setAttribute(
      'placeholder',
      t('dict.placeholder.value'),
    )
    el.querySelector<HTMLElement>('#dict-item-form')!.setAttribute('rules', RULES_ITEM())
    el.querySelector<HTMLElement>('[data-testid="dif-cancel"]')!.textContent = t('common.cancel')
    el.querySelector<HTMLElement>('[data-testid="dif-save"]')!.textContent = t('common.save')
    // 类型列表 / 键值区（pane 标题、列定义、空态文案）随语言重渲；选中态由内部状态恢复
    renderTypeList()
    renderItems()
  }

  void refresh()
  return onLocaleChange(refreshText)
}
