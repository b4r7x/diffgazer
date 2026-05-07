"use client"

import { useMemo } from "react"
import { getEncodedListboxItemId, useListbox } from "@/hooks/use-listbox"

const options = [
  { id: "alpha", label: "Alpha" },
  { id: "beta", label: "Beta" },
  { id: "gamma", label: "Gamma" },
]

export default function ListboxBasicExample() {
  const items = useMemo(
    () => options.map((option) => ({ id: option.id })),
    [],
  )
  const {
    selectedId,
    highlightedId,
    handleItemActivate,
    handleItemHighlight,
    getContainerProps,
  } = useListbox({
    idPrefix: "example-listbox",
    items,
    defaultSelectedId: "beta",
  })

  return (
    <div
      {...getContainerProps()}
      aria-label="Example options"
      className="flex w-64 flex-col border border-border bg-background p-1"
    >
      {options.map((option) => {
        const selected = selectedId === option.id
        const highlighted = highlightedId === option.id
        return (
          <div
            key={option.id}
            id={getEncodedListboxItemId("example-listbox", option.id)}
            role="option"
            data-value={option.id}
            aria-selected={selected}
            onMouseEnter={() => handleItemHighlight(option.id)}
            onClick={() => handleItemActivate(option.id)}
            className={[
              "cursor-default px-3 py-2 text-sm transition-colors",
              highlighted ? "bg-muted text-foreground" : "text-muted-foreground",
              selected ? "font-medium" : "font-normal",
            ].join(" ")}
          >
            {option.label}
          </div>
        )
      })}
    </div>
  )
}
