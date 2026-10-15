import { create } from 'zustand'
import type { IssueStatus } from '@/types'

interface UIState {
  activeProjectId: string
  activeIssueId: string | null
  activeView: 'list' | 'board' | 'timeline'
  statusFilter: IssueStatus | 'all'
  search: string
  setProject(id: string): void
  setIssue(id: string | null): void
  setView(v: 'list' | 'board' | 'timeline'): void
  setStatusFilter(f: IssueStatus | 'all'): void
  setSearch(s: string): void
}

export const useUIStore = create<UIState>((set) => ({
  activeProjectId: '',
  activeIssueId: null,
  activeView: 'list',
  statusFilter: 'all',
  search: '',
  setProject: (id) => set({ activeProjectId: id }),
  setIssue: (id) => set({ activeIssueId: id }),
  setView: (v) => set({ activeView: v }),
  setStatusFilter: (f) => set({ statusFilter: f }),
  setSearch: (s) => set({ search: s }),
}))
