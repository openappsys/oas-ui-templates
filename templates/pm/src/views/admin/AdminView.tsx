import { t, type DictKey, type Lang } from '@/i18n'
import type { Member } from '@/types'
import type { ThemePreference } from '@/lib/preferences'
import { ConfigTab } from './ConfigTab'
import { CyclesTab } from './CyclesTab'
import { MembersTab } from './MembersTab'
import { OverviewTab } from './OverviewTab'
import { PermissionsTab } from './PermissionsTab'
import { ProjectsTab } from './ProjectsTab'
import { SettingsTab } from './SettingsTab'

export type AdminTab =
  | 'overview'
  | 'projects'
  | 'members'
  | 'cycles'
  | 'config'
  | 'permissions'
  | 'settings'

const TABS: Array<{ id: AdminTab; labelKey: DictKey }> = [
  { id: 'overview', labelKey: 'adminNavOverview' },
  { id: 'projects', labelKey: 'adminNavProjects' },
  { id: 'members', labelKey: 'adminNavMembers' },
  { id: 'cycles', labelKey: 'adminNavCycles' },
  { id: 'config', labelKey: 'adminNavConfig' },
  { id: 'permissions', labelKey: 'adminNavPermissions' },
  { id: 'settings', labelKey: 'adminNavSettings' },
]

export function AdminView({
  tab,
  onTab,
  onBack,
  memberMap,
  onOpenProject,
  currentUser,
  onMemberDeleted,
  themePref,
  onSetTheme,
  lang,
  onSetLang,
}: {
  tab: AdminTab
  onTab: (tab: AdminTab) => void
  onBack: () => void
  memberMap: Map<string, Member>
  onOpenProject: (projectId: string) => void
  currentUser: string
  onMemberDeleted: (id: string) => void
  themePref: ThemePreference
  onSetTheme: (pref: ThemePreference) => void
  lang: Lang
  onSetLang: (lang: Lang) => void
}) {
  return (
    <div className="admin-layout" data-testid="admin-view">
      <nav className="admin-nav">
        <button className="admin-nav-back" type="button" data-testid="admin-back" onClick={onBack}>
          <oas-icon name="arrow-left" size={14} />
          <span>{t('adminBack')}</span>
        </button>
        {TABS.map((x) => (
          <button
            key={x.id}
            className={`admin-nav-item${tab === x.id ? ' is-active' : ''}`}
            type="button"
            data-testid={`admin-nav-${x.id}`}
            onClick={() => onTab(x.id)}
          >
            <span>{t(x.labelKey)}</span>
          </button>
        ))}
      </nav>
      <main className="admin-content">
        {tab === 'overview' ? (
          <OverviewTab memberMap={memberMap} onOpenProject={onOpenProject} />
        ) : tab === 'projects' ? (
          <ProjectsTab memberMap={memberMap} />
        ) : tab === 'members' ? (
          <MembersTab currentUser={currentUser} onMemberDeleted={onMemberDeleted} />
        ) : tab === 'cycles' ? (
          <CyclesTab lang={lang} />
        ) : tab === 'config' ? (
          <ConfigTab />
        ) : tab === 'permissions' ? (
          <PermissionsTab />
        ) : (
          <SettingsTab
            themePref={themePref}
            onSetTheme={onSetTheme}
            lang={lang}
            onSetLang={onSetLang}
          />
        )}
      </main>
    </div>
  )
}
