import type { Member } from '@/types'
import { UNASSIGNED } from './filters'

/** 列表工具条「成员」多选的选项：成员名 + 当前窗口计数后缀（窗口内条数，量级参考），
 *  末项「未分配」用 UNASSIGNED 哨兵与 assigneeFilter 直接对接；不计数的项不带后缀 */
export function buildAssigneeOptions(
  members: Member[] | undefined,
  counts: Map<string, number>,
  labels: { unassigned: string },
): Array<{ label: string; value: string }> {
  return [
    ...(members ?? []).map((m) => ({
      label: `${m.name} (${counts.get(m.id) ?? 0})`,
      value: m.id,
    })),
    { label: labels.unassigned, value: UNASSIGNED },
  ]
}
