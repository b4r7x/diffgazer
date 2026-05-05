import { useState, useRef } from "react";
import { useScopedNavigation } from "@diffgazer/keys";
import { DemoWrapper } from "../components/demo-wrapper";

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
  const [activatedItem, setActivatedItem] = useState<string | null>(null);

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
    setActivatedItem(value);
    setTimeout(() => setActivatedItem(null), 1500);
  };

  const { highlighted, isHighlighted } = useScopedNavigation({
    containerRef,
    role: "option",
    onSelect: (value) => toggleSelection(value),
    onEnter: (value) => activateItem(value),
    wrap: true,
    initialValue: "apple",
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
      <div ref={containerRef} className="demo-card">
        <div className="demo-list">
          {fruits.map((fruit) => {
            const value = fruit.toLowerCase();
            const focused = isHighlighted(value);
            const selected = selectedItems.has(value);
            return (
              <div
                key={value}
                role="option"
                data-value={value}
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
