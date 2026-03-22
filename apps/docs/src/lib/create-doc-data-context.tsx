import { createContext, useContext, type ReactNode } from "react"

interface DocDataContextResult<T> {
  Provider: (props: { value: T | null; children: ReactNode }) => ReactNode
  useData: (name?: string | null) => T | null
}

export function createDocDataContext<T extends { name: string }>(
  options?: { returnValueWhenNoName?: boolean }
): DocDataContextResult<T> {
  const ctx = createContext<T | null>(null)

  function Provider({ value, children }: { value: T | null; children: ReactNode }) {
    return <ctx.Provider value={value}>{children}</ctx.Provider>
  }

  function useData(name?: string | null): T | null {
    const value = useContext(ctx)
    if (!name) return options?.returnValueWhenNoName ? value : null
    if (!value) return null
    if (value.name !== name) return null
    return value
  }

  return { Provider, useData }
}
