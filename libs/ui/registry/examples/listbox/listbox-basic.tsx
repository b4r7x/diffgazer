"use client";

import { getEncodedListboxItemId, useListbox } from "@/hooks/use-listbox";

const options = [
  { id: "alpha", label: "Alpha" },
  { id: "beta", label: "Beta" },
  { id: "gamma", label: "Gamma" },
];

const items = options.map((option) => ({ id: option.id }));

export default function ListboxBasicExample() {
  const {
    selectedId,
    highlighted: highlightedItemId,
    handleItemActivate,
    getContainerProps,
  } = useListbox({
    idPrefix: "example-listbox",
    items,
    defaultSelectedId: "beta",
  });

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: getContainerProps applies role="listbox" dynamically, which Biome cannot resolve; aria-label is valid for the listbox role.
    <div
      {...getContainerProps()}
      aria-label="Example options"
      className="flex w-64 flex-col border border-border bg-background p-1"
    >
      {options.map((option) => {
        const selected = selectedId === option.id;
        const highlighted = highlightedItemId === option.id;
        return (
          // biome-ignore lint/a11y/useFocusableInteractive: WAI-ARIA listbox/activedescendant pattern — options stay non-focusable; the listbox container holds focus and aria-activedescendant tracks the active option.
          // biome-ignore lint/a11y/useKeyWithClickEvents: option activation via Enter/Space is handled by the listbox container's onKeyDown, not per option.
          <div
            key={option.id}
            id={getEncodedListboxItemId("example-listbox", option.id)}
            role="option"
            data-value={option.id}
            aria-selected={selected}
            onClick={() => handleItemActivate(option.id)}
            className={[
              "cursor-default px-3 py-2 text-sm transition-colors",
              highlighted ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-secondary",
              selected ? "font-medium" : "font-normal",
            ].join(" ")}
          >
            {option.label}
          </div>
        );
      })}
    </div>
  );
}
