"use client"

import { useRef } from "react"
import { useNavigation } from "@diffgazer/keys"

const items = ["Apple", "Banana", "Cherry", "Date", "Elderberry"]

function getOptionId(item: string) {
  return `fruit-${item.toLowerCase()}`
}

export default function UseNavigationBasic() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { highlighted, isHighlighted, onKeyDown } = useNavigation({
    containerRef,
    role: "option",
    wrap: true,
    onSelect: (value) => alert(`Selected: ${value}`),
  })

  return (
    <div>
      <p>ArrowUp/ArrowDown navigate, Enter selects.</p>
      <div
        ref={containerRef}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="listbox"
        aria-label="Fruits"
        aria-activedescendant={highlighted ? getOptionId(highlighted) : undefined}
        style={{ padding: 4, border: "1px solid currentColor" }}
      >
        {items.map((item) => (
          <div
            key={item}
            id={getOptionId(item)}
            role="option"
            aria-selected={isHighlighted(item)}
            data-value={item}
            style={{ padding: "4px 8px", fontWeight: isHighlighted(item) ? 700 : 400 }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
