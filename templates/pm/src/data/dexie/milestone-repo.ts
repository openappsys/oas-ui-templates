import { nanoid } from 'nanoid'
import { fromLiveQuery } from '@/data/observable'
import type { Milestone } from '@/types'
import type { MilestoneRepository } from '@/data/types'
import type { PMDatabase } from '@/db/schema'

export function createDexieMilestoneRepository(db: PMDatabase): MilestoneRepository {
  return {
    async all(projectId) {
      return db.milestones.where('projectId').equals(projectId).sortBy('dueAt')
    },
    live(projectId) {
      return fromLiveQuery(() => db.milestones.where('projectId').equals(projectId).sortBy('dueAt'))
    },
    async get(id) {
      return db.milestones.get(id)
    },
    async create(input) {
      const m: Milestone = { id: nanoid(), createdAt: Date.now(), ...input }
      await db.milestones.add(m)
      return m
    },
    async update(id, changes) {
      await db.milestones.update(id, changes)
    },
    async delete(id) {
      await db.milestones.delete(id)
    },
  }
}
