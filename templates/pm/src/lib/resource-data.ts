import type { ResourceItem, ResourceTask } from '@oas-ui/ui/data/resource'
import type { Issue, Member } from '@/types'

/** 虚拟「未分配」资源行 id（无 assigneeId 的任务都挂到这一行） */
export const UNASSIGNED_ID = '__unassigned__'

export interface ResourceViewData {
  resources: ResourceItem[]
  tasks: ResourceTask[]
}

const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** 成员 + Issue → oas-resource 数据：成员行（容量 1）+ 未分配虚拟行；
 *  任务收「未完成且有截止日」的 Issue，start 回落 createdAt，按 end 升序截 200 条 */
export function toResourceData(
  members: Member[],
  issues: Issue[],
  unassignedLabel: string,
): ResourceViewData {
  const resources: ResourceItem[] = [
    ...members.map((m) => ({ id: m.id, name: m.name, capacity: 1 })),
    { id: UNASSIGNED_ID, name: unassignedLabel, capacity: 1 },
  ]
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
  return { resources, tasks }
}
