import type { ResourceItem, ResourceTask } from '@oas-ui/ui/data/resource'
import type { Issue, Member } from '@/types'

/** 虚拟「未分配」资源行 id（无 assigneeId 的任务都挂到这一行） */
export const UNASSIGNED_ID = '__unassigned__'

export interface ResourceViewData {
  resources: ResourceItem[]
  tasks: ResourceTask[]
}

export interface ResourceAssignmentDiff {
  id: string
  assigneeId: string | null
}

const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** 成员 + Issue → oas-resource 数据：成员行（容量 1）+ 未分配虚拟行；
 *  任务收「未完成且有截止日」的 Issue，start 回落 createdAt，按 end 升序截 200 条；
 *  无任务的资源行不产出（筛选视图下空泳道是噪音） */
export function toResourceData(
  members: Member[],
  issues: Issue[],
  unassignedLabel: string,
): ResourceViewData {
  const tasks: ResourceTask[] = issues
    .filter((i) => i.dueAt !== null && i.status !== 'done' && i.status !== 'cancelled')
    .map((i) => ({
      id: i.id,
      name: `${i.key} ${i.title}`,
      start: toDate(i.startAt ?? i.createdAt),
      end: toDate(i.dueAt as number),
      resources: [i.assigneeId ?? UNASSIGNED_ID],
    }))
    .sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0))
    .slice(0, 200)
  const used = new Set(tasks.flatMap((t) => t.resources))
  const resources: ResourceItem[] = [
    ...members.filter((m) => used.has(m.id)).map((m) => ({ id: m.id, name: m.name, capacity: 1 })),
    ...(used.has(UNASSIGNED_ID) ? [{ id: UNASSIGNED_ID, name: unassignedLabel, capacity: 1 }] : []),
  ]
  return { resources, tasks }
}

/** 均载前后改派 diff：按 id 对齐两批任务，只比 resources[0]（有效分配），
 *  __unassigned__ ↔ null 互转；仅产出实际改派的条目，缺 id 或只在一侧出现跳过不抛 */
export function diffResourceAssignments(
  before: ResourceTask[],
  after: ResourceTask[],
): ResourceAssignmentDiff[] {
  const prev = new Map(before.map((task) => [task.id, task]))
  const diffs: ResourceAssignmentDiff[] = []
  for (const nt of after) {
    if (!nt.id) continue
    const ot = prev.get(nt.id)
    if (!ot) continue
    const nextOwner = nt.resources?.[0] ?? UNASSIGNED_ID
    const prevOwner = ot.resources?.[0] ?? UNASSIGNED_ID
    if (nextOwner === prevOwner) continue
    diffs.push({ id: nt.id, assigneeId: nextOwner === UNASSIGNED_ID ? null : nextOwner })
  }
  return diffs
}
