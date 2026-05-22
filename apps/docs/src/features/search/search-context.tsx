import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

interface SearchContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open, setOpen])
  return <SearchContext value={value}>{children}</SearchContext>
}

export function useSearchOpen() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error("useSearchOpen must be used within SearchProvider")
  return ctx
}
