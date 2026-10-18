import { t, type DictKey } from '@/i18n'
import type { Member } from '@/types'
import { OverviewTab } from './OverviewTab'

export type AdminTab = 'overview' | 'projects' | 'members' | 'config' | 'permissions' | 'settings'

const TABS: Array<{ id: AdminTab; labelKey: DictKey }> = [
  { id: 'overview', labelKey: 'adminNavOverview' },
  { id: 'projects', labelKey: 'adminNavProjects' },
  { id: 'members', labelKey: 'adminNavMembers' },
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
}: {
  tab: AdminTab
  onTab: (tab: AdminTab) => void
  onBack: () => void
  memberMap: Map<string, Member>
  onOpenProject: (projectId: string) => void
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
      <div className="admin-content">
        {tab === 'overview' ? (
          <OverviewTab memberMap={memberMap} onOpenProject={onOpenProject} />
        ) : (
          <div className="admin-tab" data-testid={`admin-tab-${tab}`}>
            <oas-empty description={t('adminTabPlaceholder')} />
          </div>
        )}
      </div>
    </div>
  )
}
