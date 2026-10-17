import { createContext, useContext, type ReactNode } from 'react'
import type { Repositories } from './types'
import { dexieRepositories } from './dexie'

const RepositoriesContext = createContext<Repositories>(dexieRepositories)

export function RepositoriesProvider({
  value = dexieRepositories,
  children,
}: {
  value?: Repositories
  children: ReactNode
}) {
  return <RepositoriesContext.Provider value={value}>{children}</RepositoriesContext.Provider>
}

export function useRepositories(): Repositories {
  return useContext(RepositoriesContext)
}
