import { useMemo } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { can as policyCan, type Action, type Ctx, type Subject } from './policy'

export function usePermissions(currentUserId: string): {
  subject: Subject
  can(action: Action, ctx?: Ctx): boolean
  isAdmin: boolean
} {
  const { members } = useRepositories()
  const membersList = useObservable(() => members.liveAll(), [])
  const subject = useMemo<Subject>(
    () => ({
      id: currentUserId,
      role: membersList?.find((m) => m.id === currentUserId)?.role ?? 'viewer',
    }),
    [currentUserId, membersList],
  )
  return {
    subject,
    isAdmin: subject.role === 'admin',
    can: (action, ctx) => policyCan(subject, action, ctx),
  }
}
