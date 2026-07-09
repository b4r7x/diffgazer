"use client";

import { useRef, useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
// @hidden-imports-ok — demo imports the useNavigation re-export from the hidden use-navigation hook registry item
import { useNavigation } from "@/hooks/use-navigation";

const items = ["Components", "Hooks", "Utilities", "Themes", "Plugins"];
const listboxId = "search-results";

function getOptionId(item: string) {
  return `${listboxId}-${item.toLowerCase()}`;
}

export default function SearchInputKeyboard() {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = items.filter((item) => item.toLowerCase().includes(query.toLowerCase()));

  const { isHighlighted, highlighted, onKeyDown, highlight } = useNavigation({
    containerRef: listRef,
    role: "option",
    wrap: true,
    onSelect: (value) => setQuery(value),
  });

  return (
    <div className="w-72 border border-border">
      <SearchInput
        value={query}
        onChange={(v) => {
          setQuery(v);
          highlight(null);
        }}
        placeholder="Search items..."
        role="combobox"
        aria-controls={listboxId}
        aria-activedescendant={highlighted ? getOptionId(highlighted) : undefined}
        aria-expanded={filtered.length > 0}
        aria-autocomplete="list"
        onEscape={() => {
          setQuery("");
          highlight(null);
        }}
        onEnter={() => {
          if (highlighted) setQuery(highlighted);
        }}
        onKeyDown={onKeyDown}
      />
      {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA combobox pattern — role="listbox" on a <ul> is the standard popup list paired with the combobox input. */}
      <ul ref={listRef} id={listboxId} role="listbox" className="font-mono text-xs">
        {filtered.map((item) => (
          // biome-ignore lint/a11y/useFocusableInteractive: options stay non-focusable; the combobox input keeps focus and aria-activedescendant tracks the active option.
          <li
            key={item}
            id={getOptionId(item)}
            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA listbox pattern — role="option" on a <li> is the standard option element inside the listbox.
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
  );
}
