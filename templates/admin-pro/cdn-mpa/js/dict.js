import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'
import {
  createDictItem,
  createDictType,
  listDictItems,
  listDictTypes,
  removeDictItem,
  updateDictItem,
  updateDictType,
} from './data/system.js'

function boot() {
  document.title = `${t('nav.dict')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './dict.html' })
  window.OASShell.setBreadcrumb([{ label: 'nav.dict' }])
  renderDict()
}

// 登录守卫 + 启动渲染（置于模块末尾，避免 TDZ）

function rulesTypeJSON() {
  return JSON.stringify({
    name: [{ required: true, message: t('dict.rule.typeName') }],
    code: [{ required: true, message: t('dict.rule.typeCode') }],
  })
}

function rulesItemJSON() {
  return JSON.stringify({
    label: [{ required: true, message: t('dict.rule.label') }],
    value: [{ required: true, message: t('dict.rule.value') }],
  })
}

function renderDict() {
  const state = {
    types: [],
    counts: {},
    selectedTypeId: null,
    editingTypeId: null,
    editingItemId: null,
    loadedItems: [],
  }
  let saving = false

  const typeList = document.querySelector('[data-testid="dict-type-list"]')
  const itemTable = document.querySelector('[data-testid="dict-items-table"]')
  const itemWrap = document.querySelector('#dict-items-wrap')
  const paneTitle = document.querySelector('#dict-pane-title')
  const typeModal = document.querySelector('[data-testid="dict-type-modal"]')
  const itemModal = document.querySelector('[data-testid="dict-item-modal"]')
  const typeForm = document.querySelector('#dict-type-form')
  const itemForm = document.querySelector('#dict-item-form')

  function openModal(target) {
    target.setAttribute('visible', '')
  }
  function closeModal(target) {
    target.removeAttribute('visible')
  }

  function renderTypeList() {
    if (state.types.length === 0) {
      typeList.innerHTML = `<div class="dict-empty">${t('dict.empty.types')}</div>`
      return
    }
    typeList.innerHTML = state.types
      .map(
        (
          ty,
        ) => `<button type="button" class="dict-type-item${ty.id === state.selectedTypeId ? ' is-selected' : ''}" data-id="${ty.id}" data-testid="dict-type-item">
          <span class="dict-type-name">${ty.name}</span>
          <span class="dict-type-code mono">${ty.code}</span>
          <span class="dict-type-count">${state.counts[ty.id] ?? 0}</span>
        </button>`,
      )
      .join('')
  }

  function itemColumns() {
    return [
      { key: 'label', title: t('dict.th.label') },
      { key: 'value', title: t('dict.th.value') },
      { key: 'sort', title: t('dict.th.sort'), align: 'right' },
      {
        key: 'action',
        title: t('dict.th.action'),
        render: (r) => {
          const ctx = document.createElement('div')
          ctx.className = 'action-cell'
          const edit = document.createElement('oas-button')
          edit.setAttribute('data-edit', String(r.id))
          edit.setAttribute('size', 'small')
          edit.setAttribute('type', 'text')
          edit.textContent = t('common.edit')
          const pop = document.createElement('oas-popconfirm')
          pop.setAttribute('data-del', String(r.id))
          pop.setAttribute('title', t('dict.confirmDeleteItem'))
          const del = document.createElement('oas-button')
          del.setAttribute('size', 'small')
          del.setAttribute('type', 'danger')
          del.textContent = t('common.delete')
          pop.appendChild(del)
          ctx.appendChild(edit)
          ctx.appendChild(pop)
          return ctx
        },
      },
    ]
  }

  function renderItems() {
    const ty = state.types.find((x) => x.id === state.selectedTypeId)
    if (!ty) {
      paneTitle.innerHTML = `<span class="dict-pane-title">${t('dict.itemTitle')}</span><div class="dict-pane-sub">${t('dict.empty.selectType')}</div>`
      itemWrap.hidden = true
      return
    }
    paneTitle.innerHTML = `<span class="dict-pane-title">${ty.name}</span><div class="dict-pane-sub">${tf('dict.itemCount', { code: ty.code, count: state.counts[ty.id] ?? 0 })}</div>`
    itemWrap.hidden = false
    const items = state.loadedItems
    itemTable.columns = itemColumns()
    itemTable.setAttribute('data', JSON.stringify(items))
    itemWrap.classList.toggle('table-hidden', items.length === 0)
  }

  async function refreshItems() {
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

  function openTypeForm(ty) {
    state.editingTypeId = ty?.id ?? null
    document.querySelector('[data-testid="dtf-name"]').setAttribute('value', ty?.name ?? '')
    document.querySelector('[data-testid="dtf-code"]').setAttribute('value', ty?.code ?? '')
    document.querySelector('#dict-type-title').textContent = ty
      ? tf('dict.editType', { name: ty.name })
      : t('dict.newType')
    openModal(typeModal)
  }

  function openItemForm(item) {
    if (state.selectedTypeId == null) return
    state.editingItemId = item?.id ?? null
    document.querySelector('[data-testid="dif-label"]').setAttribute('value', item?.label ?? '')
    document.querySelector('[data-testid="dif-value"]').setAttribute('value', item?.value ?? '')
    document
      .querySelector('[data-testid="dif-sort"]')
      .setAttribute('value', item ? String(item.sort) : '')
    document.querySelector('#dict-item-title').textContent = item
      ? tf('dict.editItem', { label: item.label })
      : t('dict.newItem')
    openModal(itemModal)
  }

  async function refresh() {
    state.types = await listDictTypes()
    if (state.selectedTypeId == null || !state.types.some((x) => x.id === state.selectedTypeId)) {
      state.selectedTypeId = state.types[0]?.id ?? null
    }
    state.loadedItems = []
    await Promise.all(
      state.types.map(async (ty) => {
        state.counts[ty.id] = (await listDictItems(ty.id)).length
      }),
    )
    renderTypeList()
    await refreshItems()
  }

  typeList.addEventListener('click', (e) => {
    const item = e.target.closest?.('[data-id]')
    if (!item) return
    state.selectedTypeId = Number(item.getAttribute('data-id'))
    renderTypeList()
    refreshItems()
  })

  document.querySelector('[data-testid="dict-type-create"]').addEventListener('click', () => {
    openTypeForm(null)
  })

  document.querySelector('[data-testid="dict-item-create"]').addEventListener('click', () => {
    if (state.selectedTypeId == null) {
      OASUI.message.warning(t('dict.warn.selectType'))
      return
    }
    openItemForm(null)
  })

  document
    .querySelector('[data-testid="dtf-cancel"]')
    .addEventListener('click', () => closeModal(typeModal))
  document
    .querySelector('[data-testid="dif-cancel"]')
    .addEventListener('click', () => closeModal(itemModal))
  document.querySelector('[data-testid="dtf-save"]').addEventListener('click', () => {
    typeForm.shadowRoot?.querySelector('form')?.requestSubmit()
  })
  document.querySelector('[data-testid="dif-save"]').addEventListener('click', () => {
    itemForm.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  typeForm.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = e.detail?.values ?? {}
      const name = values.name?.trim()
      const code = values.code?.trim()
      if (!name || !code) return
      if (state.editingTypeId == null) {
        await createDictType({ name, code })
        OASUI.message.success(t('common.created'))
      } else {
        const updated = await updateDictType(state.editingTypeId, { name, code })
        if (!updated) OASUI.message.error(t('dict.notFoundType'))
        else OASUI.message.success(t('common.saved'))
      }
      closeModal(typeModal)
      state.selectedTypeId = null
      state.loadedItems = []
      await refresh()
    } finally {
      saving = false
    }
  })

  itemForm.addEventListener('oas-submit', async (e) => {
    if (saving || state.selectedTypeId == null) return
    saving = true
    try {
      const values = e.detail?.values ?? {}
      const label = values.label?.trim()
      const value = values.value?.trim()
      if (!label || !value) return
      const sort = Number(values.sort) || 0
      if (state.editingItemId == null) {
        await createDictItem({ typeId: state.selectedTypeId, label, value, sort })
        OASUI.message.success(t('common.created'))
      } else {
        const updated = await updateDictItem(state.editingItemId, { label, value, sort })
        if (!updated) OASUI.message.error(t('dict.notFoundItem'))
        else OASUI.message.success(t('common.saved'))
      }
      closeModal(itemModal)
      await refreshItems()
    } finally {
      saving = false
    }
  })

  itemTable.addEventListener('click', (e) => {
    const editBtn = e.composedPath().find((n) => n.matches?.('[data-edit]'))
    if (editBtn) {
      const item = state.loadedItems.find((d) => d.id === Number(editBtn.getAttribute('data-edit')))
      if (item) openItemForm(item)
    }
  })
  itemTable.addEventListener('oas-ok', (e) => {
    // popconfirm ok 事件带 detail.source，直接反查来源
    const pc = e.detail?.source
    if (!pc?.hasAttribute?.('data-del')) return
    removeDictItem(Number(pc.getAttribute('data-del'))).then(() => {
      OASUI.message.success(t('common.deleted'))
      refreshItems()
    })
  })

  typeForm.setAttribute('rules', rulesTypeJSON())
  itemForm.setAttribute('rules', rulesItemJSON())
  refresh()
}

if (guard()) boot()
