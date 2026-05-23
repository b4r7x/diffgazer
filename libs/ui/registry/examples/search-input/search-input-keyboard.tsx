"use client"

import { useNavigation } from "@diffgazer/keys"
import { SearchInput } from "@/components/ui/search-input"
import { useRef, useState } from "react"

const items = ["Components", "Hooks", "Utilities", "Themes", "Plugins"]
const listboxId = "search-results"

function getOptionId(item: string) {
  return `${listboxId}-${item.toLowerCase()}`
}

export default function SearchInputKeyboard() {
  const [query, setQuery] = useState("")
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = items.filter((item) =>
    item.toLowerCase().includes(query.toLowerCase())
  )

  const { isHighlighted, highlighted, onKeyDown, highlight } = useNavigation({
    containerRef: listRef,
    role: "option",
    wrap: true,
    onSelect: (value) => setQuery(value),
  })

  return (
    <div className="w-72 border border-border">
      <SearchInput
        value={query}
        onChange={(v) => {
          setQuery(v)
          highlight("")
        }}
        placeholder="Search items..."
        role="combobox"
        aria-controls={listboxId}
        aria-activedescendant={highlighted ? getOptionId(highlighted) : undefined}
        aria-expanded={filtered.length > 0}
        aria-autocomplete="list"
        onEscape={() => {
          setQuery("")
          highlight("")
        }}
        onEnter={() => {
          if (highlighted) setQuery(highlighted)
        }}
        onKeyDown={onKeyDown}
      />
      <ul ref={listRef} id={listboxId} role="listbox" className="font-mono text-xs">
        {filtered.map((item) => (
          <li
            key={item}
            id={getOptionId(item)}
            role="option"
            data-value={item}
            aria-selected={isHighlighted(item)}
            className={`px-3 py-1.5 ${
              isHighlighted(item)
                ? "bg-foreground text-background font-bold"
                : "text-muted-foreground"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
