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

type TabPerm = 'project' | 'member' | 'workspace'

/** 每个管理页对应的权限：无 perm = 进入管理区即可见；anyOf = 满足任一即可 */
const TABS: Array<{ id: AdminTab; labelKey: DictKey; perm?: TabPerm; anyOf?: TabPerm[] }> = [
  { id: 'overview', labelKey: 'adminNavOverview' },
  { id: 'projects', labelKey: 'adminNavProjects', perm: 'project' },
  { id: 'members', labelKey: 'adminNavMembers', perm: 'member' },
  { id: 'cycles', labelKey: 'adminNavCycles', perm: 'project' },
  { id: 'config', labelKey: 'adminNavConfig', perm: 'workspace' },
  { id: 'permissions', labelKey: 'adminNavPermissions', anyOf: ['project', 'workspace'] },
  { id: 'settings', labelKey: 'adminNavSettings', perm: 'workspace' },
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
  canProject,
  canMember,
  canWorkspace,
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
  canProject: boolean
  canMember: boolean
  canWorkspace: boolean
}) {
  const allowed: Record<TabPerm, boolean> = {
    project: canProject,
    member: canMember,
    workspace: canWorkspace,
  }
  const visible = TABS.filter((x) =>
    x.anyOf ? x.anyOf.some((p) => allowed[p]) : x.perm ? allowed[x.perm] : true,
  )
  const effectiveTab = visible.some((x) => x.id === tab) ? tab : visible[0].id

  return (
    <div className="admin-layout" data-testid="admin-view">
      <nav className="admin-nav">
        <button className="admin-nav-back" type="button" data-testid="admin-back" onClick={onBack}>
          <oas-icon name="arrow-left" size={14} />
          <span>{t('adminBack')}</span>
        </button>
        {visible.map((x) => (
          <button
            key={x.id}
            className={`admin-nav-item${effectiveTab === x.id ? ' is-active' : ''}`}
            type="button"
            aria-current={effectiveTab === x.id ? 'page' : undefined}
            data-testid={`admin-nav-${x.id}`}
            onClick={() => onTab(x.id)}
          >
            <span>{t(x.labelKey)}</span>
          </button>
        ))}
      </nav>
      <main className="admin-content">
        {effectiveTab === 'overview' ? (
          <OverviewTab memberMap={memberMap} onOpenProject={onOpenProject} />
        ) : effectiveTab === 'projects' ? (
          <ProjectsTab memberMap={memberMap} currentUser={currentUser} />
        ) : effectiveTab === 'members' ? (
          <MembersTab
            currentUser={currentUser}
            onMemberDeleted={onMemberDeleted}
            canWorkspace={canWorkspace}
          />
        ) : effectiveTab === 'cycles' ? (
          <CyclesTab lang={lang} />
        ) : effectiveTab === 'config' ? (
          <ConfigTab />
        ) : effectiveTab === 'permissions' ? (
          <PermissionsTab currentUser={currentUser} canWorkspace={canWorkspace} />
        ) : (
          <SettingsTab
            currentUser={currentUser}
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
