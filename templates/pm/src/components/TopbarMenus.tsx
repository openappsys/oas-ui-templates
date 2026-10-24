import { useEffect, useRef } from 'react'
import type { Lang } from '@/i18n'
import { t } from '@/i18n'
import type { FilterPlacement } from '@/lib/preferences'
import type { Member } from '@/types'
import { Avatar } from './Avatar'

/** oas-dropdown 的选中事件契约：detail.value 为被点项的 value */
type SelectEvent = CustomEvent<{ value?: string }>

/** 订阅 oas-select：light-DOM 的 oas-dropdown-item 只是数据载体，
 *  真正可点的是内层 oas-menu 渲染的行——事件挂在 dropdown 宿主上才收得到 */
function useDropdownSelect(
  ref: React.RefObject<HTMLElement | null>,
  onSelect: (value: string) => void,
) {
  const cb = useRef(onSelect)
  cb.current = onSelect
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = (e: Event) => {
      const v = (e as SelectEvent).detail?.value
      if (typeof v === 'string' && v !== '') cb.current(v)
    }
    el.addEventListener('oas-select', h)
    return () => el.removeEventListener('oas-select', h)
  }, [ref])
}

/**
 * 顶栏「设置」菜单（oas-dropdown）：主题 / 语言 / 筛选位置 / 关于。
 * 低频设置收进菜单，常驻位只留一个齿轮；`hide-on-click="false"` 让主题/语言可连点。
 * testid 保留在原控件语义上（dropdown-item 是数据载体，e2e 按可访问名点渲染行）。
 */
export function SettingsMenu({
  themeLabel,
  onCycleTheme,
  lang,
  onToggleLang,
  placement,
  onPlacement,
  onAbout,
}: {
  themeLabel: string
  onCycleTheme: () => void
  lang: Lang
  onToggleLang: () => void
  placement: FilterPlacement
  onPlacement: (next: FilterPlacement) => void
  onAbout: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const aboutRef = useRef(onAbout)
  aboutRef.current = onAbout
  useDropdownSelect(ref, (value) => {
    if (value === 'theme') onCycleTheme()
    else if (value === 'lang') onToggleLang()
    else if (value.startsWith('placement:')) onPlacement(value.slice(10) as FilterPlacement)
    else if (value === 'about') {
      // 关于是动作：先收起菜单再开弹窗，否则菜单盖在弹窗上
      ref.current?.removeAttribute('open')
      aboutRef.current()
    }
  })

  return (
    <oas-dropdown
      ref={ref}
      className="tb-menu"
      data-testid="settings-menu"
      placement="bottom-end"
      trigger="click"
      arrow="false"
      hide-on-click="false"
      value={`placement:${placement}`}
    >
      <button
        type="button"
        className="tb-menu-trigger"
        data-testid="settings-trigger"
        aria-label={t('settings')}
        title={t('settings')}
      >
        <oas-icon name="gear" size={15} />
      </button>
      <oas-dropdown-item value="theme" kind="action" icon="gear" data-testid="theme-toggle">
        {`${t('adminTheme')}: ${themeLabel}`}
      </oas-dropdown-item>
      <oas-dropdown-item value="lang" kind="action" icon="language" data-testid="lang-toggle">
        {`${t('adminLanguage')}: ${lang === 'zh' ? '中文' : 'English'}`}
      </oas-dropdown-item>
      <oas-dropdown-divider />
      <oas-dropdown-group label={t('filterPlacement')} data-testid="filters-placement">
        <oas-dropdown-item value="placement:sidebar" data-testid="filters-placement-sidebar">
          {t('placementSidebar')}
        </oas-dropdown-item>
        <oas-dropdown-item value="placement:topbar" data-testid="filters-placement-topbar">
          {t('placementTopbar')}
        </oas-dropdown-item>
        <oas-dropdown-item value="placement:both" data-testid="filters-placement-both">
          {t('placementBoth')}
        </oas-dropdown-item>
      </oas-dropdown-group>
      <oas-dropdown-divider />
      <oas-dropdown-item value="about" kind="action" icon="info" data-testid="toolbar-about">
        {t('about')}
      </oas-dropdown-item>
    </oas-dropdown>
  )
}

/**
 * 顶栏「用户菜单」（oas-dropdown）：头像 + 姓名作触发器。
 * Dexie 演示模式可切换身份（进入既有 modal-user）；API 模式身份由 token 决定，只给登出。
 * themePref 只用来参与文案刷新（语言/主题切换后菜单项重渲染）。
 */
export function UserMenu({
  member,
  name,
  apiMode,
  onProfile,
  onSwitchUser,
  onSignOut,
}: {
  member: Member | undefined
  name: string
  apiMode: boolean
  onProfile: () => void
  onSwitchUser: () => void
  onSignOut: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  useDropdownSelect(ref, (value) => {
    if (value === 'profile') onProfile()
    else if (value === 'switch-user') onSwitchUser()
    else if (value === 'logout') onSignOut()
  })
  return (
    <oas-dropdown
      ref={ref}
      className="tb-user-menu"
      data-testid="user-menu"
      placement="bottom-end"
      trigger="click"
      arrow="false"
    >
      <button
        className="tb-user"
        type="button"
        data-testid="tb-user"
        title={apiMode ? name : t('paletteSwitchUser')}
        aria-haspopup="menu"
      >
        <Avatar member={member} size={22} />
        <span className="tb-user-name">{name}</span>
        <oas-icon name="chevron-down" size={12} className="tb-user-caret" />
      </button>
      <oas-dropdown-item value="profile" kind="action" icon="user" data-testid="tb-profile">
        {t('profile')}
      </oas-dropdown-item>
      <oas-dropdown-divider />
      {apiMode ? (
        <oas-dropdown-item value="logout" kind="action" icon="close" data-testid="tb-logout">
          {t('logout')}
        </oas-dropdown-item>
      ) : (
        <oas-dropdown-item
          value="switch-user"
          kind="action"
          icon="user"
          data-testid="tb-switch-user"
        >
          {t('paletteSwitchUser')}
        </oas-dropdown-item>
      )}
    </oas-dropdown>
  )
}
