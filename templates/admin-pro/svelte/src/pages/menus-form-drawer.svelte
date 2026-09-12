<script module lang="ts">
  // src/pages/menus-form-drawer.svelte —— 权限抽屉表单（类型单选/perms 自动补全/父级选项自包含）
  // 1. visible 由父组件 open 单一事实来源驱动；组件侧关闭（遮罩/Esc/✕）经 oas-close 回写
  // 2. open 边沿回填：逐字段 setAttribute + 父级选项树 + radio checked 命令式同步
  //    （oas-radio excludeSameName 会命令式改兄弟属性，声明式 checked 会打架，走同通道）
  // 3. C 类型 perms 自动补全（autoPerms）：open 边沿/类型切换/path 输入三个时机
  // 4. 取消/保存按钮为 oas-button 原生 click 直绑（Svelte 不走根委托，panel 内亦可达）；
  //    radio 组的 oas-change（kebab 自定义事件）经 bind:this + $effect 容器委托；
  //    提交只收集值，校验与树变更编排在父组件（校验失败不关抽屉）
  import type { MenuTree, MenuType } from '../data/system'
  import { useT } from '../lib/use-t.svelte'
  import { parentOf } from './menus-tree'

  /** vanilla PERM_RE/autoPerms：C 类型按 path 首段自动生成 perms */
  export function autoPerms(type: MenuType, path: string): string {
    if (type !== 'C') return ''
    const seg = (path || '').replace(/^\/+/, '').split('/').filter(Boolean)[0] || ''
    const mod = seg.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    return mod ? `${mod}:list` : ''
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
</script>

<script lang="ts">
  let { open, editing, presetParentId, tree, onClose, onSubmit }: MenusFormDrawerProps = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重算 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let formType = $state<MenuType>('C')

  let drawerEl: HTMLElement | null = $state(null)
  let formEl: HTMLElement | null = $state(null)
  let typeGroupEl: HTMLDivElement | null = $state(null)
  let nameEl: HTMLElement | null = $state(null)
  let parentEl: HTMLElement | null = $state(null)
  let permsEl: HTMLElement | null = $state(null)
  let pathEl: HTMLElement | null = $state(null)

  function isMenuType(v: string | null): v is MenuType {
    return v === 'M' || v === 'C' || v === 'F'
  }

  /** C 类型且 perms 为空时按当前 path 自动补全 */
  const syncMenuType = (type: MenuType): void => {
    if (type === 'C') {
      const cur = permsEl?.getAttribute('value') ?? ''
      if (!cur) {
        const auto = autoPerms('C', pathEl?.getAttribute('value') ?? '')
        if (auto) permsEl?.setAttribute('value', auto)
      }
    }
  }

  /** radio checked 命令式同步（与组件 excludeSameName 同通道，避免声明式打架） */
  function syncRadios(type: MenuType): void {
    typeGroupEl?.querySelectorAll<HTMLElement>('oas-radio').forEach((r) => {
      if (r.getAttribute('value') === type) r.setAttribute('checked', '')
      else r.removeAttribute('checked')
    })
  }

  // open 边沿回填：字段值 + 父级选项树/展开 + radio 同步 + perms 自动补全
  $effect(() => {
    if (!open) return
    void editing
    void presetParentId
    const node = editing
    const nextType: MenuType = node?.type ?? 'C'
    nameEl?.setAttribute('value', node?.title ?? '')
    const pid = node ? parentOf(tree, node.id) : presetParentId
    parentEl?.setAttribute('value', String(pid ?? 0))
    permsEl?.setAttribute('value', node?.perms ?? '')
    pathEl?.setAttribute('value', node?.path ?? '')
    const toOpt = (list: MenuTree[]): Array<Record<string, unknown>> =>
      list.map((n) => ({
        value: String(n.id),
        label: n.title,
        children: n.children?.length ? toOpt(n.children) : undefined,
      }))
    parentEl?.setAttribute(
      'options',
      JSON.stringify([{ value: '0', label: tt('menus.option.top'), children: toOpt(tree) }]),
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
    parentEl?.setAttribute('expanded', JSON.stringify(expanded))
    formType = nextType
    syncRadios(nextType)
    syncMenuType(nextType)
  })

  // locale 切换重挂 radio 组后 / formType 变化后同步 checked
  $effect(() => {
    void $locale
    void formType
    void open
    syncRadios(formType)
  })

  // radio 组容器委托 oas-change（kebab 自定义事件不能在 div 上模板直绑）
  $effect(() => {
    const el = typeGroupEl
    if (!el) return
    el.addEventListener('oas-change', onTypeChange)
    return () => el.removeEventListener('oas-change', onTypeChange)
  })

  function onTypeChange(e: Event): void {
    const radio = e.composedPath()[0] as HTMLElement
    if (!(radio instanceof HTMLElement) || !radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value')
    if (isMenuType(v)) {
      formType = v
      syncMenuType(v)
    }
  }

  // path 输入：C 类型且 perms 为空时按新值自动补全（闭包经响应式访问器读 formType/permsEl，值常新）
  const pathAttrs = $derived({
    'onoas-input': (e: Event) => {
      if (formType !== 'C') return
      const cur = permsEl?.getAttribute('value') ?? ''
      if (!cur) {
        const auto = autoPerms('C', (e as CustomEvent<{ value: string }>).detail.value)
        if (auto) permsEl?.setAttribute('value', auto)
      }
    },
  })

  /** 保存：触发 oas-form shadow 内原生 form 提交（跨 shadow requestSubmit 通道） */
  function onSave(): void {
    ;(formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

  // oas-submit：只收集值（name 来自事件、其余来自 open 边沿写入的属性）
  function onFormSubmit(e: Event): void {
    const { values } = (e as CustomEvent<{ values: { name?: string } }>).detail
    const parentRaw = parentEl?.getAttribute('value') || '0'
    onSubmit({
      name: (values.name ?? '').trim(),
      type: formType,
      parentId: parentRaw === '0' ? null : Number(parentRaw),
      perms: (permsEl?.getAttribute('value') ?? '').trim(),
      path: (pathEl?.getAttribute('value') ?? '').trim(),
    })
  }

  const permsHint = $derived(
    formType === 'C'
      ? tt('menus.hint.autoPerms')
      : formType === 'M'
        ? tt('menus.hint.noPermForDir')
        : tt('menus.hint.required'),
  )
</script>

<oas-drawer
  bind:this={drawerEl}
  data-testid="menu-form-drawer"
  title={editing ? tt('menus.editMenu', { title: editing.title }) : tt('menus.new')}
  placement="right"
  size="medium"
  no-footer
  visible={open ? '' : null}
  onoas-close={onClose}
>
  <oas-form
    bind:this={formEl}
    rules={JSON.stringify({ name: [{ required: true, message: tt('menus.rule.name') }] })}
    onoas-submit={onFormSubmit}
  >
    <div class="menu-form-body">
      <div class="form-field">
        <label class="form-label">
          {tt('menus.form.name')} <span class="req">*</span>
        </label>
        <oas-input bind:this={nameEl} data-testid="mf-name" name="name" placeholder={tt('menus.rule.name')}>
        </oas-input>
      </div>
      <div class="form-field">
        <label class="form-label">{tt('menus.form.type')}</label>
        <div class="radio-group inline" id="mf-type" bind:this={typeGroupEl}>
          {#each ['M', 'C', 'F'] as ty (ty)}
            <oas-radio name="menuType" value={ty}>
              <span class="radio-label">{tt(`menus.type.${ty}`)}</span>
            </oas-radio>
          {/each}
        </div>
      </div>
      <div class="form-field">
        <label class="form-label">{tt('menus.form.parent')}</label>
        <oas-tree-select bind:this={parentEl} data-testid="mf-parent" placeholder={tt('menus.placeholder.top')}>
        </oas-tree-select>
      </div>
      <div class="form-field">
        <label class="form-label">
          {tt('menus.form.perms')}
          <span class="form-hint-inline" id="mf-perms-hint">{permsHint}</span>
        </label>
        <oas-input bind:this={permsEl} data-testid="mf-perms" name="perms" placeholder={tt('menus.placeholder.perms')}>
        </oas-input>
      </div>
      <div class="form-field">
        <label class="form-label">
          {tt('menus.form.path')}
          <span class="req" id="mf-path-req">{formType === 'C' ? '*' : ''}</span>
        </label>
        <oas-input
          bind:this={pathEl}
          data-testid="mf-path"
          name="path"
          placeholder={tt('menus.placeholder.path')}
          {...pathAttrs}
        ></oas-input>
      </div>
      <div class="form-actions">
        <oas-space justify="end">
          <oas-button data-testid="mf-cancel" onclick={onClose}>{tt('common.cancel')}</oas-button>
          <oas-button data-testid="mf-save" type="primary" onclick={onSave}>{tt('common.save')}</oas-button>
        </oas-space>
      </div>
    </div>
  </oas-form>
</oas-drawer>

<style>
  /* 抽屉表单体（自 react 版 menus.css 迁入）；oas-tree-select 撑满 */
  .menu-form-body {
    display: flex;
    flex-direction: column;
    gap: var(--oas-space-4);
  }
  .menu-form-body oas-tree-select {
    width: 100%;
  }
</style>
