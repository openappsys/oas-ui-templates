import type { PMDatabase } from '@/db/schema'
import { db } from '@/db/schema'
import type { Repositories } from '@/data/types'
import { createDexieIssueRepository } from './issue-repo'
import { createDexieProjectRepository } from './project-repo'
import { createDexieMemberRepository } from './member-repo'
import { createDexieCommentRepository } from './comment-repo'
import { createDexieActivityRepository } from './activity-repo'
import { createDexieSavedViewRepository } from './saved-view-repo'
import { createDexieCycleRepository } from './cycle-repo'
import { createDexieSettingsRepository } from './settings-repo'
import { createDexieNotificationRepository } from './notification-repo'
import { createDexieAdminRepository } from './admin-repo'
import { createDexieRoleRepository } from './role-repo'
import {
  createDexieAuditRepository,
  createDexieProjectMemberRepository,
  createDexieProjectRoleRepository,
} from './audit-repo'

export function createDexieRepositories(database: PMDatabase): Repositories {
  return {
    issues: createDexieIssueRepository(database),
    projects: createDexieProjectRepository(database),
    members: createDexieMemberRepository(database),
    comments: createDexieCommentRepository(database),
    activities: createDexieActivityRepository(database),
    savedViews: createDexieSavedViewRepository(database),
    cycles: createDexieCycleRepository(database),
    settings: createDexieSettingsRepository(database),
    notifications: createDexieNotificationRepository(database),
    roles: createDexieRoleRepository(database),
    audit: createDexieAuditRepository(database),
    projectRoles: createDexieProjectRoleRepository(database),
    projectMembers: createDexieProjectMemberRepository(database),
    admin: createDexieAdminRepository(database),
  }
}

export const dexieRepositories: Repositories = createDexieRepositories(db)
