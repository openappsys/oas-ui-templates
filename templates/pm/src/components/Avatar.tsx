import type { Member } from '@/types'

/* ── 通用小组件 ── */
export function Avatar({ member, size = 20 }: { member?: Member; size?: number }) {
  if (!member) {
    return (
      <span className="avatar avatar-empty" style={{ width: size, height: size }} title="未分配">
        ?
      </span>
    )
  }
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: member.avatarColor }}
      title={member.name}
    >
      {member.name[0]}
    </span>
  )
}
