import { useEffect, useMemo, useRef, useState } from 'react'
import { t, type Lang } from '@/i18n'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import type { Action, Ctx } from '@/permission/policy'
import type { Issue } from '@/types'

export type PaletteView = 'dashboard' | 'issues' | 'board' | 'timeline' | 'resource' | 'schedule'

interface CommandItem {
  label: string
  value: string
  keywords?: string[]
  group?: string
  disabled?: boolean
  icon?: string
  shortcut?: string
  description?: string
  page?: CommandItem[]
  separator?: boolean
}

type CommandHost = HTMLElement & { items?: CommandItem[] }

export function CommandPalette({
  open,
  onClose,
  can,
  onView,
  onNewIssue,
  onExportCsv,
  onSaveView,
  onToggleTheme,
  onToggleLang,
  onShortcuts,
  onSwitchUser,
  onOpenIssue,
  lang,
}: {
  open: boolean
  onClose: () => void
  can: (action: Action, ctx?: Ctx) => boolean
  onView: (v: PaletteView) => void
  onNewIssue: () => void
  onExportCsv: () => void
  onSaveView: () => void
  onToggleTheme: () => void
  onToggleLang: () => void
  onShortcuts: () => void
  onSwitchUser: (id: string) => void
  onOpenIssue: (id: string) => void
  lang: Lang
}) {
  const hostRef = useRef<CommandHost>(null)
  const { issues: issuesRepo, members: membersRepo } = useRepositories()
  const members = useObservable(() => membersRepo.liveAll(), [membersRepo])
  const [query, setQuery] = useState('')
  const [issueCache, setIssueCache] = useState<Issue[] | null>(null)
  const depthRef = useRef(0)

  const rootItems = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      {
        label: t('dashboard'),
        value: 'nav:dashboard',
        group: t('paletteNav'),
        keywords: ['dashboard'],
      },
      {
        label: t('list'),
        value: 'nav:issues',
        group: t('paletteNav'),
        keywords: ['list', 'issues'],
      },
      {
        label: t('board'),
        value: 'nav:board',
        group: t('paletteNav'),
        keywords: ['board', 'kanban'],
      },
      {
        label: t('timeline'),
        value: 'nav:timeline',
        group: t('paletteNav'),
        keywords: ['timeline', 'gantt'],
      },
      {
        label: t('resource'),
        value: 'nav:resource',
        group: t('paletteNav'),
        keywords: ['resource', '资源'],
      },
      {
        label: t('schedule'),
        value: 'nav:schedule',
        group: t('paletteNav'),
        keywords: ['calendar', 'schedule', '日程'],
      },
    ]
    const actions: CommandItem[] = []
    if (can('issue:create')) {
      actions.push({
        label: t('shortcutNew'),
        value: 'act:new-issue',
        group: t('paletteActions'),
        keywords: ['new', 'create'],
      })
    }
    actions.push({
      label: t('exportCsv'),
      value: 'act:export-csv',
      group: t('paletteActions'),
      keywords: ['csv', 'export'],
    })
    if (can('view:save')) {
      actions.push({
        label: t('saveView'),
        value: 'act:save-view',
        group: t('paletteActions'),
        keywords: ['view'],
      })
    }
    actions.push({
      label: t('paletteToggleTheme'),
      value: 'act:toggle-theme',
      group: t('paletteActions'),
      keywords: ['theme', 'dark', 'light'],
    })
    actions.push({
      label: t('paletteToggleLang'),
      value: 'act:toggle-lang',
      group: t('paletteActions'),
      keywords: ['lang', 'locale'],
    })
    actions.push({
      label: t('shortcutHelp'),
      value: 'act:shortcuts',
      group: t('paletteActions'),
      keywords: ['shortcuts', 'help'],
    })
    const switcher: CommandItem = {
      label: t('paletteSwitchUser'),
      value: 'switch-user',
      group: t('paletteSwitchUser'),
      page: (members ?? []).map((m) => ({ label: m.name, value: `user:${m.id}` })),
    }
    return [...nav, ...actions, switcher]
  }, [can, members, lang])

  useEffect(() => {
    if (!open || issueCache) return
    let alive = true
    issuesRepo
      .listAll(2000)
      .then((list) => {
        if (!alive) return
        setIssueCache(list)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open, issueCache, issuesRepo])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const sync = () => {
      if (open) {
        if (!el.hasAttribute('open')) el.setAttribute('open', '')
      } else {
        if (el.hasAttribute('open')) el.removeAttribute('open')
        depthRef.current = 0
        setQuery('')
      }
      const search = el.shadowRoot?.querySelector<HTMLInputElement>('.search')
      if (search) search.placeholder = t('palettePlaceholder')
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(el, { attributes: true, attributeFilter: ['open'] })
    return () => obs.disconnect()
  }, [open])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const q = query.trim().toLowerCase()
    let next: CommandItem[]
    if (!q) {
      next = rootItems
    } else {
      const head = rootItems.filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          (it.keywords ?? []).some((k) => k.toLowerCase().includes(q)),
      )
      const matched = (issueCache ?? [])
        .filter(
          (i) =>
            (i.title ?? '').toLowerCase().includes(q) || (i.key ?? '').toLowerCase().includes(q),
        )
        .slice(0, 8)
        .map((i) => ({
          label: `${i.key} ${i.title}`,
          value: `issue:${i.id}`,
          group: t('paletteIssues'),
        }))
      next = [...head, ...matched]
    }
    el.items = next
    const search = el.shadowRoot?.querySelector<HTMLInputElement>('.search')
    if (search) search.placeholder = t('palettePlaceholder')
  }, [query, rootItems, issueCache, lang])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const onInput = (e: Event) => {
      const v = (e as CustomEvent<{ value: string }>).detail?.value ?? ''
      if (depthRef.current === 0) setQuery(v)
    }
    const onSelect = (e: Event) => {
      const v = (e as CustomEvent<{ value?: string }>).detail?.value
      if (typeof v !== 'string' || v === '') return
      if (v.startsWith('nav:')) onView(v.slice(4) as PaletteView)
      else if (v === 'act:new-issue') onNewIssue()
      else if (v === 'act:export-csv') onExportCsv()
      else if (v === 'act:save-view') onSaveView()
      else if (v === 'act:toggle-theme') onToggleTheme()
      else if (v === 'act:toggle-lang') onToggleLang()
      else if (v === 'act:shortcuts') onShortcuts()
      else if (v.startsWith('user:')) onSwitchUser(v.slice(5))
      else if (v.startsWith('issue:')) onOpenIssue(v.slice(6))
    }
    const onOpenChange = (e: Event) => {
      if ((e as CustomEvent<{ open: boolean }>).detail?.open === false) {
        depthRef.current = 0
        onClose()
      }
    }
    const onPageChange = (e: Event) => {
      const d = (e as CustomEvent<{ depth: number }>).detail?.depth ?? 0
      depthRef.current = d
      if (d === 0) {
        setQuery('')
      }
    }
    el.addEventListener('oas-input', onInput)
    el.addEventListener('oas-select', onSelect)
    el.addEventListener('oas-open-change', onOpenChange)
    el.addEventListener('oas-page-change', onPageChange)
    return () => {
      el.removeEventListener('oas-input', onInput)
      el.removeEventListener('oas-select', onSelect)
      el.removeEventListener('oas-open-change', onOpenChange)
      el.removeEventListener('oas-page-change', onPageChange)
    }
  }, [
    onView,
    onNewIssue,
    onExportCsv,
    onSaveView,
    onToggleTheme,
    onToggleLang,
    onShortcuts,
    onSwitchUser,
    onOpenIssue,
    onClose,
  ])

  return (
    <oas-command
      ref={hostRef}
      data-testid="command-palette"
      should-filter="false"
      hotkey=""
      placeholder={t('palettePlaceholder')}
    >
      <span slot="empty" style={{ color: 'var(--oas-color-text-secondary)', fontSize: '13px' }}>
        {t('emptyNoMatch')}
      </span>
      <span slot="footer" style={{ color: 'var(--oas-color-text-secondary)', fontSize: '12px' }}>
        {t('paletteHints')}
      </span>
    </oas-command>
  )
}
