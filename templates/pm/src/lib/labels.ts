import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'

export const DEFAULT_LABELS = [
  'frontend',
  'backend',
  'design',
  'bug',
  'feature',
  'tech-debt',
  'docs',
  'infra',
]

export function useLabelSet(): string[] {
  const { settings } = useRepositories()
  const stored = useObservable(() => settings.live<string[]>('labels'), [settings])
  return Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_LABELS
}
