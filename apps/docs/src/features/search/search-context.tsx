import { createContext, useContext, useState, type ReactNode } from "react"

interface SearchContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <SearchContext value={{ open, setOpen }}>{children}</SearchContext>
}

export function useSearchOpen() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error("useSearchOpen must be used within SearchProvider")
  return ctx
}
