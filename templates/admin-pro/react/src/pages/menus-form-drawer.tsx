// src/pages/menus-form-drawer.tsx —— 权限抽屉表单（类型单选/perms 自动补全/父级选项自包含）
// 1. visible 由父组件 open 单一事实来源驱动；组件侧关闭（遮罩/Esc/✕）经 oas-close 回写
// 2. open 边沿回填：逐字段 setAttribute + 父级选项树 + radio checked 命令式同步
//    （oas-radio excludeSameName 会命令式改兄弟属性，声明式 checked 会打架，走同通道）
// 3. C 类型 perms 自动补全（autoPerms）：open 边沿/类型切换/path 输入三个时机
// 4. 面板内取消/保存按钮为 shadow panel 内原生 click（React 根委托收不到），例外直绑
//    addEventListener，经回调 ref 转发保证拿到最新 props；提交只收集值，校验与树变更
//    编排在父组件（校验失败不关抽屉）
import { useEffect, useRef, useState } from 'react'
import type { MenuTree, MenuType } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { parentOf } from './menus-tree'

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla PERM_RE/autoPerms：C 类型按 path 首段自动生成 perms */
export function autoPerms(type: MenuType, path: string): string {
  if (type !== 'C') return ''
  const seg = (path || '').replace(/^\/+/, '').split('/').filter(Boolean)[0] || ''
  const mod = seg.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return mod ? `${mod}:list` : ''
}

function isMenuType(v: string | null): v is MenuType {
  return v === 'M' || v === 'C' || v === 'F'
}

/** 提交载荷：抽屉收集值，校验与树变更由父组件完成 */
export interface MenuSubmitPayload {
  name: string
  type: MenuType
  parentId: number | null
  perms: string
  path: string
}

export interface MenusFormDrawerProps {
  open: boolean
  /** 编辑目标（null → 新建态） */
  editing: MenuTree | null
  /** 「新增子菜单」预置的父级 id（编辑态忽略，取节点现父级） */
  presetParentId: number | null
  tree: MenuTree[]
  onClose: () => void
  onSubmit: (payload: MenuSubmitPayload) => void
}

export function MenusFormDrawer({
  open,
  editing,
  presetParentId,
  tree,
  onClose,
  onSubmit,
}: MenusFormDrawerProps) {
  const { t, locale } = useT()
  const [formType, setFormType] = useState<MenuType>('C')
  const drawerRef = useRef<HTMLElement | null>(null)
  const formRef = useRef<HTMLElement | null>(null)
  const typeGroupRef = useRef<HTMLDivElement | null>(null)
  const nameRef = useRef<HTMLElement | null>(null)
  const parentRef = useRef<HTMLElement | null>(null)
  const permsRef = useRef<HTMLElement | null>(null)
  const pathRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLElement | null>(null)
  const saveRef = useRef<HTMLElement | null>(null)

  // 回调镜像：空依赖挂载的直绑监听经此拿到最新 onClose/onSubmit
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit

  const syncMenuType = (type: MenuType) => {
    if (type === 'C') {
      const cur = permsRef.current?.getAttribute('value') ?? ''
      if (!cur) {
        const auto = autoPerms('C', pathRef.current?.getAttribute('value') ?? '')
        if (auto) permsRef.current?.setAttribute('value', auto)
      }
    }
  }

  useEffect(() => {
    if (!open) return
    const node = editing
    const nextType: MenuType = node?.type ?? 'C'
    nameRef.current?.setAttribute('value', node?.title ?? '')
    const pid = node ? parentOf(tree, node.id) : presetParentId
    parentRef.current?.setAttribute('value', String(pid ?? 0))
    permsRef.current?.setAttribute('value', node?.perms ?? '')
    pathRef.current?.setAttribute('value', node?.path ?? '')
    const toOpt = (list: MenuTree[]): Array<Record<string, unknown>> =>
      list.map((n) => ({
        value: String(n.id),
        label: n.title,
        children: n.children?.length ? toOpt(n.children) : undefined,
      }))
    parentRef.current?.setAttribute(
      'options',
      JSON.stringify([{ value: '0', label: t('menus.option.top'), children: toOpt(tree) }]),
    )
    const expanded: string[] = []
    const walk = (list: MenuTree[]) => {
      for (const n of list) {
        if (n.children?.length) {
          expanded.push(String(n.id))
          walk(n.children)
        }
      }
    }
    walk(tree)
    parentRef.current?.setAttribute('expanded', JSON.stringify(expanded))
    setFormType(nextType)
    // radio checked 命令式同步（与组件 excludeSameName 同通道）
    typeGroupRef.current?.querySelectorAll<HTMLElement>('oas-radio').forEach((r) => {
      if (r.getAttribute('value') === nextType) r.setAttribute('checked', '')
      else r.removeAttribute('checked')
    })
    syncMenuType(nextType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, presetParentId])

  // 重建 radio 组后 setRadioChecked 同款时机）
  useEffect(() => {
    typeGroupRef.current?.querySelectorAll<HTMLElement>('oas-radio').forEach((r) => {
      if (r.getAttribute('value') === formType) r.setAttribute('checked', '')
      else r.removeAttribute('checked')
    })
  }, [locale, formType, open])

  // panel 内原生 click 例外直绑（取消=关闭；保存=触发内部原生 form 提交）
  useEffect(() => {
    const cancel = cancelRef.current
    const save = saveRef.current
    const onCancel = () => onCloseRef.current()
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

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(drawerRef, 'oas-close', () => onCloseRef.current())

  useOasEvent(typeGroupRef, 'oas-change', (_d, ev) => {
    const radio = ev.composedPath()[0] as HTMLElement
    if (!(radio instanceof HTMLElement) || !radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value')
    if (isMenuType(v)) {
      setFormType(v)
      syncMenuType(v)
    }
  })

  useOasEvent<{ value: string }>(pathRef, 'oas-input', (d) => {
    if (formType !== 'C') return
    const cur = permsRef.current?.getAttribute('value') ?? ''
    if (!cur) {
      const auto = autoPerms('C', d.value)
      if (auto) permsRef.current?.setAttribute('value', auto)
    }
  })

  // 表单校验通过后的提交：只收集值（name 来自事件、其余来自 open 边沿写入的属性）
  useOasEvent<{ values: { name?: string } }>(formRef, 'oas-submit', (d) => {
    const parentRaw = parentRef.current?.getAttribute('value') || '0'
    onSubmitRef.current({
      name: (d.values.name ?? '').trim(),
      type: formType,
      parentId: parentRaw === '0' ? null : Number(parentRaw),
      perms: (permsRef.current?.getAttribute('value') ?? '').trim(),
      path: (pathRef.current?.getAttribute('value') ?? '').trim(),
    })
  })

  const permsHint =
    formType === 'C'
      ? t('menus.hint.autoPerms')
      : formType === 'M'
        ? t('menus.hint.noPermForDir')
        : t('menus.hint.required')

  return (
    <oas-drawer
      ref={drawerRef}
      data-testid="menu-form-drawer"
      title={editing ? t('menus.editMenu', { title: editing.title }) : t('menus.new')}
      placement="right"
      size="medium"
      no-footer
      visible={open}
    >
      <oas-form
        ref={formRef}
        rules={JSON.stringify({ name: [{ required: true, message: t('menus.rule.name') }] })}
      >
        <div className="menu-form-body">
          <div className="form-field">
            <label className="form-label">
              {t('menus.form.name')} <span className="req">*</span>
            </label>
            <oas-input
              ref={nameRef}
              data-testid="mf-name"
              name="name"
              placeholder={t('menus.rule.name')}
            />
          </div>
          <div className="form-field">
            <label className="form-label">{t('menus.form.type')}</label>
            <div className="radio-group inline" id="mf-type" ref={typeGroupRef}>
              {(['M', 'C', 'F'] as const).map((ty) => (
                <oas-radio key={ty} name="menuType" value={ty}>
                  <span className="radio-label">{t(`menus.type.${ty}`)}</span>
                </oas-radio>
              ))}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">{t('menus.form.parent')}</label>
            <oas-tree-select
              ref={parentRef}
              data-testid="mf-parent"
              placeholder={t('menus.placeholder.top')}
            />
          </div>
          <div className="form-field">
            <label className="form-label">
              {t('menus.form.perms')}{' '}
              <span className="form-hint-inline" id="mf-perms-hint">
                {permsHint}
              </span>
            </label>
            <oas-input
              ref={permsRef}
              data-testid="mf-perms"
              name="perms"
              placeholder={t('menus.placeholder.perms')}
            />
          </div>
          <div className="form-field">
            <label className="form-label">
              {t('menus.form.path')}{' '}
              <span className="req" id="mf-path-req">
                {formType === 'C' ? '*' : ''}
              </span>
            </label>
            <oas-input
              ref={pathRef}
              data-testid="mf-path"
              name="path"
              placeholder={t('menus.placeholder.path')}
            />
          </div>
          <div className="form-actions">
            <oas-space justify="end">
              <oas-button ref={cancelRef} data-testid="mf-cancel">
                {t('common.cancel')}
              </oas-button>
              <oas-button ref={saveRef} data-testid="mf-save" type="primary">
                {t('common.save')}
              </oas-button>
            </oas-space>
          </div>
        </div>
      </oas-form>
    </oas-drawer>
  )
}
