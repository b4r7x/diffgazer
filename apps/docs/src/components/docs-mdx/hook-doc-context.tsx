import { createContext, useContext, type ReactNode } from "react"
import type { HookDocPageProps } from "@/components/hook-doc-page"

export type HookData = HookDocPageProps["data"]

const HookDocDataContext = createContext<HookData | null>(null)

interface HookDocDataProviderProps {
  value: HookData | null
  children: ReactNode
}

export function HookDocDataProvider({
  value,
  children,
}: HookDocDataProviderProps) {
  return (
    <HookDocDataContext.Provider value={value}>
      {children}
    </HookDocDataContext.Provider>
  )
}

export function useHookDocData(name?: string | null): HookData | null {
  const value = useContext(HookDocDataContext)
  if (!name) return value
  if (!value) return null
  if (value.name !== name) return null
  return value
}
