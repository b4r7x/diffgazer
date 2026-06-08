"use client";

import { useNavigation } from "@diffgazer/keys";
import { useRef } from "react";

const items = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

function getOptionId(item: string) {
  return `fruit-${item.toLowerCase()}`;
}

export default function UseNavigationBasic() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { highlighted, isHighlighted, onKeyDown } = useNavigation({
    containerRef,
    role: "option",
    wrap: true,
    onSelect: (value) => alert(`Selected: ${value}`),
  });

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
          // biome-ignore lint/a11y/useFocusableInteractive: WAI-ARIA listbox/activedescendant pattern — options stay non-focusable; the listbox container holds focus and aria-activedescendant tracks the active option.
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
  );
}
