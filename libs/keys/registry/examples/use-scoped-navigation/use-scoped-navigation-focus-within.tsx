"use client"

import { useRef } from "react"
import { KeyboardProvider, useScopedNavigation } from "@diffgazer/keys"

const left = ["Inbox", "Drafts", "Sent", "Archive"]
const right = ["Today", "This week", "Later"]

function List({ label, items }: { label: string; items: string[] }) {
  const listRef = useRef<HTMLDivElement>(null)

  // focusWithinOnly: arrow keys only drive the list whose focus is active, so
  // both lists coexist under one provider without an explicit scope each.
  const { isHighlighted } = useScopedNavigation({
    containerRef: listRef,
    role: "option",
    wrap: true,
    focusWithinOnly: true,
  })

  return (
    <div style={{ minWidth: 140 }}>
      <h4>{label}</h4>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        style={{ padding: 4, border: "1px solid currentColor" }}
      >
        {items.map((item) => (
          <div
            key={item}
            role="option"
            data-value={item}
            aria-selected={isHighlighted(item)}
            style={{ padding: "4px 8px", fontWeight: isHighlighted(item) ? 700 : 400 }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function UseScopedNavigationFocusWithin() {
  return (
    <KeyboardProvider>
      <div>
        <p>Tab between the two listboxes. Arrow keys move only the focused list.</p>
        <div style={{ display: "flex", gap: 24 }}>
          <List label="Folders" items={left} />
          <List label="Filters" items={right} />
        </div>
      </div>
    </KeyboardProvider>
  )
}
