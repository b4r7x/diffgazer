"use client"

import { useState } from "react"
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateMessage,
} from "@/components/ui/empty-state"

const items = ["useNavigation", "useFocusTrap", "useScrollLock"]

export default function EmptyStateLive() {
  const [query, setQuery] = useState("")
  const filtered = items.filter((item) =>
    item.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        placeholder="Filter hooks…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border border-border bg-background px-3 py-1.5 text-sm text-foreground"
      />
      {filtered.length > 0 ? (
        <ul className="text-sm text-foreground">
          {filtered.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <EmptyState live size="sm">
          <EmptyStateMessage>No hooks match "{query}"</EmptyStateMessage>
          <EmptyStateDescription>Try a different search term.</EmptyStateDescription>
        </EmptyState>
      )}
    </div>
  )
}
