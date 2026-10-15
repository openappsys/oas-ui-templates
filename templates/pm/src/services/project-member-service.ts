import type { Member, Project } from '@/types'
import { db } from '@/db/schema'
import { liveQuery } from 'dexie'

export const memberService = {
  async all(): Promise<Member[]> {
    return db.members.toArray()
  },
  async get(id: string): Promise<Member | undefined> {
    return db.members.get(id)
  },
  async create(member: Member): Promise<void> {
    await db.members.add(member)
  },
  async update(id: string, changes: Partial<Member>): Promise<void> {
    await db.members.update(id, changes)
  },
  async delete(id: string): Promise<void> {
    await db.members.delete(id)
  },
  liveAll() {
    return liveQuery(() => db.members.toArray())
  },
}

export const projectService = {
  async all(): Promise<Project[]> {
    return db.projects.toArray()
  },
  async get(id: string): Promise<Project | undefined> {
    return db.projects.get(id)
  },
  async create(project: Project): Promise<void> {
    await db.projects.add(project)
  },
  async update(id: string, changes: Partial<Project>): Promise<void> {
    await db.projects.update(id, changes)
  },
  async delete(id: string): Promise<void> {
    await db.projects.delete(id)
  },
  liveAll() {
    return liveQuery(() => db.projects.toArray())
  },
}
