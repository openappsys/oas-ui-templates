import type { Member } from '@/types'
import { t } from '@/i18n'
import { AVATAR_UNASSIGNED } from '@/lib/colors'

export function Avatar({ member, size = 20 }: { member?: Member; size?: number }) {
  if (!member) {
    return <oas-avatar size={size} color={AVATAR_UNASSIGNED} title={t('resourceUnassigned')} />
  }
  return (
    <oas-avatar size={size} color={member.avatarColor} title={member.name} text={member.name[0]} />
  )
}
