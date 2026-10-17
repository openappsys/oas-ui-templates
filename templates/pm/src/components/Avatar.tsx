import type { Member } from '@/types'

export function Avatar({ member, size = 20 }: { member?: Member; size?: number }) {
  if (!member) {
    return <oas-avatar size={size} color="var(--oas-color-border-strong)" title="未分配" />
  }
  return (
    <oas-avatar size={size} color={member.avatarColor} title={member.name}>
      {member.name[0]}
    </oas-avatar>
  )
}
