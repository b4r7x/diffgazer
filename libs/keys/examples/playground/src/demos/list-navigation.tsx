import { useState, useRef } from "react";
import { useScopedNavigation } from "@diffgazer/keys";
import { DemoWrapper } from "../components/demo-wrapper";
import { useTransientValue } from "./use-transient-value";

const fruits = [
  "Apple",
  "Banana",
  "Cherry",
  "Date",
  "Elderberry",
  "Fig",
  "Grape",
  "Honeydew",
];

export function ListNavigationDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activatedItem, showActivatedItem] = useTransientValue<string | null>(null, 1500);

  const toggleSelection = (value: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const activateItem = (value: string) => {
    showActivatedItem(value);
  };

  const { highlighted, isHighlighted } = useScopedNavigation({
    containerRef,
    role: "option",
    onSelect: (value) => toggleSelection(value),
    onEnter: (value) => activateItem(value),
    wrap: true,
    defaultHighlighted: "apple",
  });

  return (
    <DemoWrapper
      title="List Navigation"
      description="Navigate a list with arrow keys, toggle selection with Space, and activate items with Enter. Uses useScopedNavigation — keyboard events are captured globally via KeyboardProvider."
      hints={[
        { keys: "ArrowUp", label: "Move up" },
        { keys: "ArrowDown", label: "Move down" },
        { keys: "Space", label: "Toggle selection" },
        { keys: "Enter", label: "Activate item" },
        { keys: "Home", label: "Jump to first" },
        { keys: "End", label: "Jump to last" },
      ]}
    >
      <div className="demo-card">
        <div
          ref={containerRef}
          role="listbox"
          aria-label="Fruits"
          aria-multiselectable="true"
          aria-activedescendant={highlighted ? `fruit-${highlighted}` : undefined}
          className="demo-list"
        >
          {fruits.map((fruit) => {
            const value = fruit.toLowerCase();
            const focused = isHighlighted(value);
            const selected = selectedItems.has(value);
            return (
              <div
                key={value}
                id={`fruit-${value}`}
                role="option"
                data-value={value}
                aria-selected={selected}
                className={[
                  "demo-list-item",
                  focused && "demo-list-item--focused",
                  selected && "demo-list-item--selected",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {fruit}
              </div>
            );
          })}
        </div>
      </div>

      <div className="demo-status">
        Focused: {highlighted ?? "none"} | Selected: {selectedItems.size} items
      </div>

      {activatedItem && (
        <div className="demo-action-log">Activated: {activatedItem}</div>
      )}
    </DemoWrapper>
  );
}
