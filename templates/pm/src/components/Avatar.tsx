import type { Member } from '@/types'
import { t } from '@/i18n'

export function Avatar({ member, size = 20 }: { member?: Member; size?: number }) {
  if (!member) {
    return (
      <oas-avatar
        size={size}
        color="var(--oas-color-border-strong)"
        title={t('resourceUnassigned')}
      />
    )
  }
  return (
    <oas-avatar size={size} color={member.avatarColor} title={member.name} text={member.name[0]} />
  )
}
