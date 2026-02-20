import { createContext, useContext, type ReactNode } from "react"
import type { ComponentData } from "@/types/docs-data"

const ComponentDocDataContext = createContext<ComponentData | null>(null)

interface ComponentDocDataProviderProps {
  value: ComponentData | null
  children: ReactNode
}

export function ComponentDocDataProvider({
  value,
  children,
}: ComponentDocDataProviderProps) {
  return (
    <ComponentDocDataContext.Provider value={value}>
      {children}
    </ComponentDocDataContext.Provider>
  )
}

export function useComponentDocData(name?: string | null): ComponentData | null {
  const value = useContext(ComponentDocDataContext)
  if (!name) return null
  if (!value) return null
  if (value.name !== name) return null
  return value
}
