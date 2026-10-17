import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'

/** 全项目真实计数（index count，与窗口无关） */
export function useProjectCounts(projectId: string) {
  const { issues } = useRepositories()
  return useObservable(() => issues.liveCounts(projectId), [projectId])
}
