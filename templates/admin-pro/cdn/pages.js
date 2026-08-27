import { onLocaleChange, t } from './i18n.js'

/* ---------- 种子数据（内存 CRUD + localStorage 持久化） ---------- */
const USERS_KEY = 'oas-admin-cdn.users'
const NAMES = ['张伟', '李娜', '王强', '刘洋', '陈静', '杨帆', '赵敏', '周杰', '吴倩', '郑浩',
  '孙丽', '朱军', '林霞', '何斌', '郭蕾', '马超', '罗丹', '高翔', '董洁', '萧然']

function seedUsers() {
  return NAMES.map((name, i) => ({
    id: i + 1,
    name,
    email: `user${i + 1}@example.com`,
    role: i % 5 === 0 ? 'admin' : 'viewer',
    created: `2026-0${(i % 8) + 1}-1${i % 9}`,
  }))
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* 坏数据回退种子 */
  }
  return seedUsers()
}

function saveUsers(rows) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(rows))
  } catch {
    /* ignore */
  }
}

/* ---------- dashboard ---------- */
export function renderDashboard(el) {
  function draw() {
    const user = JSON.parse(localStorage.getItem('oas-admin-cdn.session') ?? '{}')
    document.title = `${t('nav.dashboard')} · ${t('app.title')}`
    const stats = [
      { testid: 'stat-visits', label: t('dash.statVisits'), value: '12,480', delta: 12.4 },
      { testid: 'stat-users', label: t('dash.statUsers'), value: '328', delta: 8.2 },
      { testid: 'stat-orders', label: t('dash.statOrders'), value: '1,926', delta: 3.1 },
      { testid: 'stat-rate', label: t('dash.statRate'), value: '4.6%', delta: -0.4 },
    ]
    el.innerHTML = `
      <div class="page">
        <h1 class="page-title">${t('nav.dashboard')}</h1>
        <p class="page-subtitle">${t('dash.welcome')}，${user.name ?? ''}</p>
        <div class="stat-grid">
          ${stats
            .map(
              (s) => `
            <oas-card class="stat-card" data-testid="${s.testid}">
              <div class="stat-label">${s.label}</div>
              <div class="stat-value">${s.value}</div>
              <div class="stat-delta ${s.delta >= 0 ? 'delta-up' : 'delta-down'}">
                ${s.delta > 0 ? '+' : ''}${s.delta}% ${t('dash.vsYesterday')}
              </div>
            </oas-card>`,
            )
            .join('')}
        </div>
        <oas-card title="${t('dash.trendTitle')}">
          <oas-chart id="chart-trend" type="area" options='{"smooth":true,"gradient":true}'
            aria-label="${t('dash.trendTitle')}"></oas-chart>
        </oas-card>
      </div>`
    const chart = el.querySelector('#chart-trend')
    chart.data = {
      labels: ['1', '2', '3', '4', '5', '6', '7'],
      series: [{ name: t('dash.statVisits'), data: [880, 1020, 950, 1240, 1380, 1520, 1716] }],
    }
  }
  draw()
  return onLocaleChange(draw)
}

/* ---------- users ---------- */
export function renderUsers(el) {
  const state = { rows: loadUsers(), keyword: '', page: 1, editingId: null }
  const PAGE_SIZE = 8

  document.title = `${t('users.title')} · ${t('app.title')}`

  function columns() {
    return [
      { key: 'name', title: t('users.th.name') },
      { key: 'email', title: t('users.th.email') },
      {
        key: 'role',
        title: t('users.th.role'),
        render: (r) => {
          const tag = document.createElement('oas-tag')
          tag.setAttribute('type', r.role === 'admin' ? 'primary' : 'default')
          tag.textContent = t(r.role === 'admin' ? 'users.role.admin' : 'users.role.viewer')
          return tag
        },
      },
      { key: 'created', title: t('users.th.created') },
      {
        key: 'action',
        title: t('users.th.action'),
        render: (r) => {
          const wrap = document.createElement('div')
          const edit = document.createElement('oas-button')
          edit.setAttribute('size', 'small')
          edit.setAttribute('type', 'text')
          edit.setAttribute('data-edit', String(r.id))
          edit.textContent = t('users.edit')
          const pop = document.createElement('oas-popconfirm')
          pop.setAttribute('title', t('users.confirmDelete'))
          pop.setAttribute('data-del', String(r.id))
          const del = document.createElement('oas-button')
          del.setAttribute('size', 'small')
          del.setAttribute('type', 'danger')
          del.textContent = t('users.delete')
          pop.appendChild(del)
          wrap.appendChild(edit)
          wrap.appendChild(pop)
          return wrap
        },
      },
    ]
  }

  function draw() {
    el.innerHTML = `
      <div class="page">
        <h1 class="page-title">${t('users.title')}</h1>
        <div class="toolbar">
          <oas-input data-testid="users-search" placeholder="${t('users.searchPh')}"></oas-input>
          <oas-button data-testid="user-new" type="primary">${t('users.new')}</oas-button>
        </div>
        <oas-card>
          <oas-table data-testid="users-table"></oas-table>
          <div class="table-foot">
            <oas-pagination data-testid="users-pager" page-size="${PAGE_SIZE}" current="1" total="0" show-total></oas-pagination>
          </div>
        </oas-card>
        <oas-modal data-testid="user-form-modal" no-footer>
          <div style="padding: var(--oas-space-4); min-width: 320px">
            <h2 id="form-title" style="margin:0 0 var(--oas-space-3); font-size:16px"></h2>
            <oas-input data-testid="uf-name" placeholder="${t('users.th.name')}"></oas-input>
            <oas-input data-testid="uf-email" placeholder="${t('users.th.email')}" style="margin-top: var(--oas-space-2)"></oas-input>
            <div style="display:flex; gap: var(--oas-space-2); justify-content:flex-end; margin-top: var(--oas-space-3)">
              <oas-button data-testid="uf-cancel">${t('users.cancel')}</oas-button>
              <oas-button data-testid="uf-save" type="primary">${t('users.save')}</oas-button>
            </div>
          </div>
        </oas-modal>
      </div>`
    bind()
    renderTable()
  }

  function filtered() {
    const kw = state.keyword.trim().toLowerCase()
    if (!kw) return state.rows
    return state.rows.filter(
      (r) => r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw),
    )
  }

  function renderTable() {
    const table = el.querySelector('[data-testid="users-table"]')
    const pager = el.querySelector('[data-testid="users-pager"]')
    const list = filtered()
    table.columns = columns()
    if (list.length === 0) {
      table.setAttribute('data', '[]')
      pager.setAttribute('total', '0')
      pager.setAttribute('current', '1')
      return
    }
    const maxPage = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
    if (state.page > maxPage) state.page = maxPage
    const slice = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE)
    table.setAttribute('data', JSON.stringify(slice))
    pager.setAttribute('total', String(list.length))
    pager.setAttribute('current', String(state.page))
  }

  function inputValue(testid) {
    return (
      el.querySelector(`[data-testid="${testid}"]`)?.shadowRoot?.querySelector('input')?.value ?? ''
    ).trim()
  }

  function openModal(editing) {
    state.editingId = editing?.id ?? null
    el.querySelector('#form-title').textContent = t(editing ? 'users.formEdit' : 'users.formNew')
    el.querySelector('[data-testid="uf-name"]').setAttribute('value', editing?.name ?? '')
    el.querySelector('[data-testid="uf-email"]').setAttribute('value', editing?.email ?? '')
    el.querySelector('[data-testid="user-form-modal"]').setAttribute('visible', '')
  }

  function closeModal() {
    el.querySelector('[data-testid="user-form-modal"]').removeAttribute('visible')
  }

  function bind() {
    el.querySelector('[data-testid="users-search"]').addEventListener('oas-input', (e) => {
      state.keyword = e.detail.value ?? ''
      state.page = 1
      renderTable()
    })
    el.querySelector('[data-testid="user-new"]').addEventListener('click', () => openModal(null))
    el.querySelector('[data-testid="users-pager"]').addEventListener('oas-change', (e) => {
      state.page = Number(e.detail.page ?? 1)
      renderTable()
    })
    el.querySelector('[data-testid="users-table"]').addEventListener('click', (e) => {
      const editBtn = e.composedPath().find((n) => n.matches?.('[data-edit]'))
      if (editBtn) {
        const row = state.rows.find((r) => r.id === Number(editBtn.getAttribute('data-edit')))
        if (row) openModal(row)
      }
      // v2.2.8 起单元格内 popconfirm 原生自驱动，无需手动 open
    })
    el.querySelector('[data-testid="users-table"]').addEventListener('oas-ok', (e) => {
      // v2.2.8 起 popconfirm ok/cancel 事件带 detail.source，直接反查来源
      const pc = e.detail.source
      if (!pc?.hasAttribute?.('data-del')) return
      const id = Number(pc.getAttribute('data-del'))
      state.rows = state.rows.filter((r) => r.id !== id)
      saveUsers(state.rows)
      renderTable()
    })
    el.querySelector('[data-testid="uf-save"]').addEventListener('click', () => {
      const name = inputValue('uf-name')
      const email = inputValue('uf-email')
      if (!name) return
      if (state.editingId == null) {
        const id = Math.max(0, ...state.rows.map((r) => r.id)) + 1
        state.rows.unshift({ id, name, email, role: 'viewer', created: '2026-08-27' })
      } else {
        const row = state.rows.find((r) => r.id === state.editingId)
        if (row) {
          row.name = name
          row.email = email
        }
      }
      saveUsers(state.rows)
      closeModal()
      renderTable()
    })
    el.querySelector('[data-testid="uf-cancel"]').addEventListener('click', closeModal)
  }

  draw()
  return onLocaleChange(draw)
}

/* ---------- form ---------- */
export function renderForm(el) {
  function draw() {
    document.title = `${t('nav.form')} · ${t('app.title')}`
    el.innerHTML = `
      <div class="page">
        <h1 class="page-title">${t('nav.form')}</h1>
        <p class="page-subtitle">${t('form.subtitle')}</p>
        <oas-card>
          <oas-form id="basic-form" rules='${JSON.stringify({
            name: [{ required: true, message: t('form.ruleName') }],
          })}'>
            <div class="form-grid">
              <oas-input name="name" label="${t('form.name')}" placeholder="${t('form.name')}"></oas-input>
              <oas-select name="category" label="${t('form.category')}" options='[{"label":"A","value":"a"},{"label":"B","value":"b"}]'></oas-select>
              <oas-switch name="status" label="${t('form.status')}"></oas-switch>
              <oas-date-picker name="due" label="${t('form.name')}"></oas-date-picker>
            </div>
            <oas-textarea name="desc" label="${t('form.desc')}"></oas-textarea>
            <oas-space style="margin-top: var(--oas-space-3)">
              <oas-button type="primary" data-action="submit">${t('form.submit')}</oas-button>
              <oas-button data-action="reset">${t('form.reset')}</oas-button>
            </oas-space>
          </oas-form>
        </oas-card>
      </div>`
    const form = el.querySelector('#basic-form')
    form.addEventListener('oas-submit', () => {
      OASUI.message.success(t('form.submitted'))
    })
    el.querySelector('[data-action="submit"]').addEventListener('click', () => {
      form.shadowRoot?.querySelector('form')?.requestSubmit()
    })
    el.querySelector('[data-action="reset"]').addEventListener('click', () => {
      form.shadowRoot?.querySelector('form')?.reset()
      OASUI.message.info(t('form.resetDone'))
    })
  }
  draw()
  return onLocaleChange(draw)
}
