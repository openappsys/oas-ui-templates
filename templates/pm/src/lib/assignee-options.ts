import type { Member } from '@/types'
import { UNASSIGNED } from './filters'

/** 成员筛选的选项：全量计数（按项目全量，不随列表窗口变化）。
 *  「未分配」置首——它是最高频的筛选项（找没人认领的活），且与 assigneeFilter /
 *  SavedView 直接对接的哨兵就是 UNASSIGNED。计数键与筛选值同键，调用方无须转换。 */
export function buildAssigneeOptions(
  members: Member[] | undefined,
  counts: Map<string, number>,
  labels: { unassigned: string },
): Array<{ label: string; value: string }> {
  return [
    { label: `${labels.unassigned} (${counts.get(UNASSIGNED) ?? 0})`, value: UNASSIGNED },
    ...(members ?? []).map((m) => ({
      label: `${m.name} (${counts.get(m.id) ?? 0})`,
      value: m.id,
    })),
  ]
}
