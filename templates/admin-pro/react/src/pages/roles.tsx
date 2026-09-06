// src/pages/roles.tsx —— 角色管理（表格 CRUD + 抽屉表单 + 数据权限单选 + 部门 transfer）
//    刷文案）；本模版声明式——roles/deptList/editingId/dataScope/deptIds/drawerOpen 全部
//    useState，抽屉标题/customField 显隐全部由 state 派生；useT() 订阅后整页重渲染，
//    rules/labels/radio 选项文案随 locale 自动重算
// 2. 事件绑定：表格行点击（composedPath 匹配 [data-edit]）、oas-form 的 oas-submit、popconfirm
//    的 oas-ok、radio 组的 oas-change、oas-transfer 的 oas-change、oas-drawer 的 oas-close 走
//    useOasEvent / 容器 onClick（AGENTS.md 第 1 条）；页头新建按钮为 light DOM 原生 click 直绑
//    onClick；抽屉面板内取消/保存按钮按第 2 条例外直绑 addEventListener（panel 对原生事件
//    stopPropagation，React 根委托收不到）
// 3. columns 含 render 函数（scopeCell/actionCell 返回真实 DOM 节点）→ property 通道
//    本模版在 open 边沿的 useEffect 做同样的事（transfer value 只在回填时写，切换数据权限
//    effect 里命令式同步（setRadioChecked 同款通道，避免与组件 excludeSameName 打架）
//    回写 state（product-form 同款）
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TableColumn } from '@oas-ui/ui/data/table'
import { createRole, listRoles, removeRole, treeDepts, updateRole } from '../data/system'
import type { DataScope, DeptTree, RoleRow } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla dataScopeLabel */
function dataScopeLabel(scope: DataScope, t: TFunc): string {
  return t(`roles.scope.${scope}`)
}

/** vanilla DATA_SCOPE_TAG：数据权限 → 标签色 */
const DATA_SCOPE_TAG: Record<DataScope, string> = {
  1: 'primary',
  2: 'warning',
  3: 'info',
  4: 'info',
  5: 'default',
}

/** vanilla DATA_SCOPE_OPTIONS */
function dataScopeOptions(t: TFunc): Array<{ value: DataScope; label: string; desc: string }> {
  return ([1, 2, 3, 4, 5] as const).map((v) => ({
    value: v,
    label: t(`roles.scopeOpt.${v}`),
    desc: t(`roles.scopeDesc.${v}`),
  }))
}

/** vanilla scopeCell：行内数据权限标签 */
function scopeCell(row: RoleRow, t: TFunc): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.setAttribute('type', DATA_SCOPE_TAG[row.dataScope])
  tag.textContent = dataScopeLabel(row.dataScope, t)
  return tag
}

/** vanilla actionCell：编辑按钮 + popconfirm 包裹的删除按钮 */
function actionCell(row: RoleRow, t: TFunc): HTMLElement {
  const ctx = document.createElement('div')
  ctx.className = 'action-cell'
  const edit = document.createElement('oas-button')
  edit.setAttribute('data-edit', String(row.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('type', 'text')
  edit.textContent = t('common.edit')
  const pop = document.createElement('oas-popconfirm')
  pop.setAttribute('data-del', String(row.id))
  pop.setAttribute('title', t('roles.confirmDelete'))
  const del = document.createElement('oas-button')
  del.setAttribute('size', 'small')
  del.setAttribute('type', 'danger')
  del.textContent = t('common.delete')
  pop.appendChild(del)
  ctx.appendChild(edit)
  ctx.appendChild(pop)
  return ctx
}

/** vanilla TABLE_COLUMNS */
function buildColumns(t: TFunc): TableColumn[] {
  return [
    { key: 'name', title: t('roles.th.name') },
    { key: 'code', title: t('roles.th.code') },
    {
      key: 'dataScope',
      title: t('roles.th.dataScope'),
      render: (r) => scopeCell(r as unknown as RoleRow, t),
    },
    { key: 'userCount', title: t('roles.th.userCount'), align: 'right' },
    { key: 'created', title: t('roles.th.created') },
    {
      key: 'action',
      title: t('roles.th.action'),
      render: (r) => actionCell(r as unknown as RoleRow, t),
    },
  ]
}

/** vanilla flatten：部门树拍平（transfer 候选列表用） */
function flatten(roots: DeptTree[]): DeptTree[] {
  const out: DeptTree[] = []
  const walk = (nodes: DeptTree[]) => {
    for (const n of nodes) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(roots)
  return out
}

interface FormValues {
  name?: string
  code?: string
}

export default function RolesPage() {
  const { t, locale } = useT()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [deptList, setDeptList] = useState<DeptTree[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [dataScope, setDataScope] = useState<DataScope>(1)
  const [deptIds, setDeptIds] = useState<number[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const savingRef = useRef(false)

  const tableRef = useRef<HTMLElement | null>(null)
  const drawerRef = useRef<HTMLElement | null>(null)
  const formRef = useRef<HTMLElement | null>(null)
  const scopeGroupRef = useRef<HTMLDivElement | null>(null)
  const transferRef = useRef<HTMLElement | null>(null)
  const nameRef = useRef<HTMLElement | null>(null)
  const codeRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLElement | null>(null)
  const saveRef = useRef<HTMLElement | null>(null)

  // vanilla refresh()：并发拉角色 + 部门树（拍平）
  const refresh = useCallback(async () => {
    const [rows, deptTree] = await Promise.all([listRoles(), treeDepts()])
    setRoles(rows)
    setDeptList(flatten(deptTree))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const editingRow = editingId != null ? (roles.find((r) => r.id === editingId) ?? null) : null

  // vanilla setRadioChecked：radio 的 checked 命令式同步
  const setRadioChecked = (scope: DataScope) => {
    scopeGroupRef.current?.querySelectorAll<HTMLElement>('oas-radio').forEach((radio) => {
      if (Number(radio.getAttribute('value')) === scope) radio.setAttribute('checked', '')
      else radio.removeAttribute('checked')
    })
  }

  // vanilla fillForm + openForm：open 边沿逐字段 setAttribute
  useEffect(() => {
    if (!drawerOpen) return
    const row = editingRow
    nameRef.current?.setAttribute('value', row?.name ?? '')
    codeRef.current?.setAttribute('value', row?.code ?? '')
    const scope = (row?.dataScope ?? 1) as DataScope
    const ids = row?.dataScope === 2 ? [...row.deptIds] : []
    setDataScope(scope)
    setDeptIds(ids)
    transferRef.current?.setAttribute('value', JSON.stringify(ids.map(String)))
    setRadioChecked(scope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, editingId])

  // locale 变化时 radio 文案随 JSX 重算，checked 需按 dataScope 重打（vanilla refreshText 重建
  // radio 组后 setRadioChecked 同款时机）
  useEffect(() => {
    setRadioChecked(dataScope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, dataScope, drawerOpen])

  // panel 内原生 click 例外直绑（AGENTS.md 第 2 条）：取消=关闭；保存=触发内部原生 form 提交
  useEffect(() => {
    const cancel = cancelRef.current
    const save = saveRef.current
    const onCancel = () => setDrawerOpen(false)
    const onSave = () => {
      ;(
        formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null
      )?.requestSubmit()
    }
    cancel?.addEventListener('click', onCancel)
    save?.addEventListener('click', onSave)
    return () => {
      cancel?.removeEventListener('click', onCancel)
      save?.removeEventListener('click', onSave)
    }
  }, [])

  // vanilla 表格 click 段：composedPath 匹配行内编辑按钮（删除由 popconfirm 自驱动）
  const onTableWrapClick = (e: React.MouseEvent) => {
    const btn = e.nativeEvent
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-edit]'))
    if (!btn) return
    const row = roles.find((r) => r.id === Number(btn.getAttribute('data-edit')))
    if (row) {
      setEditingId(row.id)
      setDrawerOpen(true)
    }
  }

  // vanilla popconfirm oas-ok 段：detail.source 反查 data-del → 删除 → 提示 → 刷新
  useOasEvent<{ source: HTMLElement }>(tableRef, 'oas-ok', (detail) => {
    const src = detail.source
    if (!src?.hasAttribute?.('data-del')) return
    const id = Number(src.getAttribute('data-del'))
    void removeRole(id).then((ok) => {
      if (!ok) appMessage.error(t('roles.notFound'))
      else appMessage.success(t('common.deleted'))
      void refresh()
    })
  })

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(drawerRef, 'oas-close', () => setDrawerOpen(false))

  // vanilla scopeGroup oas-change 段：切数据权限；非自定义时清空 deptIds
  useOasEvent(scopeGroupRef, 'oas-change', (_d, ev) => {
    const radio = ev.composedPath()[0] as HTMLElement
    if (!(radio instanceof HTMLElement) || !radio.hasAttribute('checked')) return
    const val = Number(radio.getAttribute('value'))
    if (!Number.isFinite(val)) return
    setDataScope(val as DataScope)
    if (val !== 2) setDeptIds([])
  })

  // vanilla transfer oas-change 段
  useOasEvent<{ value: string[] }>(transferRef, 'oas-change', (d) => {
    setDeptIds(d.value.map(Number))
  })

  // vanilla oas-submit 段：create/update（deptIds 仅自定义权限携带）→ 关闭 + 刷新
  useOasEvent<{ values: FormValues }>(formRef, 'oas-submit', async (d) => {
    if (savingRef.current) return
    const name = d.values.name?.trim()
    const code = d.values.code?.trim()
    if (!name || !code) return
    savingRef.current = true
    try {
      const ids = dataScope === 2 ? deptIds : []
      if (editingId == null) {
        await createRole({ name, code, dataScope, deptIds: ids, userCount: 0 })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateRole(editingId, { name, code, dataScope, deptIds: ids })
        if (!updated) appMessage.error(t('roles.notFound'))
        else appMessage.success(t('common.saved'))
      }
      setDrawerOpen(false)
      void refresh()
    } finally {
      savingRef.current = false
    }
  })

  // 列定义按 locale 重建（vanilla renderTable 里重设 columns 同款时机）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo<TableColumn[]>(() => buildColumns(t), [locale])

  const rules = JSON.stringify({
    name: [{ required: true, message: t('roles.rule.name') }],
    code: [
      { required: true, message: t('roles.rule.code') },
      { pattern: '^[a-z][a-z0-9:_-]*$', message: t('roles.rule.codeFmt') },
    ],
  })
  const scopeOptions = dataScopeOptions(t)
  const transferData = JSON.stringify(deptList.map((d) => ({ key: String(d.id), label: d.name })))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.roles')}</h1>
          <p className="page-subtitle">{t('roles.subtitle')}</p>
        </div>
        <oas-button
          data-testid="role-create"
          type="primary"
          icon="plus"
          onClick={() => {
            setEditingId(null)
            setDrawerOpen(true)
          }}
        >
          {t('roles.new')}
        </oas-button>
      </div>
      <oas-card className="list-card" title={t('roles.list')}>
        <div className="table-wrap" id="roles-wrap" onClick={onTableWrapClick}>
          <oas-table
            ref={tableRef}
            data-testid="roles-table"
            row-key="id"
            empty-text={t('roles.empty')}
            columns={columns}
            data={JSON.stringify(roles)}
          />
        </div>
      </oas-card>

      <oas-drawer
        ref={drawerRef}
        data-testid="role-form-drawer"
        title={
          editingId == null
            ? t('roles.new')
            : t('roles.editRole').replace('#{id}', String(editingId))
        }
        placement="right"
        size="medium"
        no-footer
        visible={drawerOpen}
      >
        <oas-form ref={formRef} rules={rules}>
          <div className="role-form-body">
            <div className="form-field">
              <label className="form-label">
                {t('roles.form.name')} <span className="req">*</span>
              </label>
              <oas-input
                ref={nameRef}
                data-testid="rf-name"
                name="name"
                placeholder={t('roles.rule.name')}
              />
            </div>
            <div className="form-field">
              <label className="form-label">
                {t('roles.form.code')} <span className="req">*</span>
              </label>
              <oas-input
                ref={codeRef}
                data-testid="rf-code"
                name="code"
                placeholder={t('roles.placeholder.code')}
              />
              <div className="form-hint">{t('roles.hint.code')}</div>
            </div>
            <div className="form-field">
              <label className="form-label">{t('roles.form.dataScope')}</label>
              <div className="radio-group" id="rf-scope" ref={scopeGroupRef}>
                {scopeOptions.map((o) => (
                  <oas-radio key={o.value} name="dataScope" value={String(o.value)}>
                    <span className="radio-item">
                      <span className="radio-label">{o.label}</span>
                      <span className="radio-desc">{o.desc}</span>
                    </span>
                  </oas-radio>
                ))}
              </div>
            </div>
            <div className="form-field" id="rf-custom" hidden={dataScope !== 2 || undefined}>
              <label className="form-label">{t('roles.form.customScope')}</label>
              <oas-transfer
                ref={transferRef}
                data-testid="rf-transfer"
                id="rf-transfer"
                source-title={t('roles.transfer.source')}
                target-title={t('roles.transfer.target')}
                searchable
                data={transferData}
              />
            </div>
            <div className="form-actions">
              <oas-space justify="end">
                <oas-button ref={cancelRef} data-testid="rf-cancel">
                  {t('common.cancel')}
                </oas-button>
                <oas-button ref={saveRef} data-testid="rf-save" type="primary">
                  {t('common.save')}
                </oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-drawer>
    </div>
  )
}
