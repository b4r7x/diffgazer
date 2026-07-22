import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { expect } from "vitest";
import type { UseNavigationOptions } from "../use-navigation.js";
import { useNavigation } from "../use-navigation.js";

export function itemId(value: string) {
  return value === "" ? "item-empty" : `item-${value}`;
}

export function TestList({
  items = ["a", "b", "c"],
  ...options
}: Partial<UseNavigationOptions> & { items?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const result = useNavigation({
    containerRef: ref,
    role: "option",
    ...options,
  });

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label="Items"
      aria-activedescendant={result.highlighted === null ? undefined : itemId(result.highlighted)}
      tabIndex={0}
      onKeyDown={result.onKeyDown}
    >
      {items.map((item) => (
        // biome-ignore lint/a11y/useFocusableInteractive: the listbox owns focus through aria-activedescendant.
        <div
          key={item}
          id={itemId(item)}
          role="option"
          data-value={item}
          aria-selected={result.isHighlighted(item)}
        >
          {item || "Empty"}
        </div>
      ))}
      <button type="button" onClick={() => result.highlight("b")}>
        Highlight B
      </button>
      <button type="button" onClick={() => result.highlight(null)}>
        Clear Highlight
      </button>
    </div>
  );
}

function activeOption() {
  const listbox = screen.getByRole("listbox", { name: "Items" });
  const activeId = listbox.getAttribute("aria-activedescendant");
  return activeId ? document.getElementById(activeId) : null;
}

export function expectActiveOptionText(text: string) {
  expect(activeOption()?.textContent).toBe(text);
}

export async function focusListbox() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("listbox", { name: "Items" }));
  return user;
}
