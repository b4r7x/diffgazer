import type { RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

export interface NavigationCase {
  /** Key passed to userEvent.keyboard (e.g. "{ArrowDown}", "{Home}") OR a raw key for fireEvent fallback. */
  readonly key: string;
  /** Expected index of the active item AFTER the key press, given the initialActive index. */
  readonly expectedActiveIndex: number;
  /** Optional: human label for the test name suffix. Defaults to the key. */
  readonly label?: string;
}

export interface TestNavigationBehaviorOptions {
  /** A function that renders the component and returns the RTL result. Called fresh per case. */
  readonly setup: () => RenderResult;
  /** Accessible names of the navigable items, in DOM order. Used to locate items by getByRole/getByText. */
  readonly items: readonly string[];
  /**
   * Index of the item that starts focused/active. Defaults to 0.
   * Consumers must arrange this initial state inside `setup`; the helper does not seed focus.
   * Used by consumers to compute each case's `expectedActiveIndex`.
   */
  readonly initialActive?: number;
  /** The navigation cases to test. */
  readonly cases: readonly NavigationCase[];
  /**
   * Custom resolver for the currently-active item's index, given the render result.
   * Default behavior: read aria-activedescendant on the container, or document.activeElement.
   * Provide this when the component uses a different active-tracking convention.
   */
  readonly getActiveIndex?: (rendered: RenderResult) => number;
}

function defaultGetActiveIndex(rendered: RenderResult, items: readonly string[]): number {
  try {
    const activeDescendantHost = rendered.container.querySelector("[aria-activedescendant]");
    const activeId = activeDescendantHost?.getAttribute("aria-activedescendant");
    if (activeId) {
      const ownerDocument = activeDescendantHost?.ownerDocument ?? document;
      const target =
        ownerDocument.getElementById(activeId) ??
        rendered.container.querySelector(`[data-testid="${activeId}"]`);
      if (target) {
        const name = accessibleNameOf(target);
        const index = items.findIndex((item) => item === name);
        if (index >= 0) {
          return index;
        }
      }
    }

    const activeElement = (rendered.container.ownerDocument ?? document).activeElement;
    if (activeElement instanceof HTMLElement) {
      const name = accessibleNameOf(activeElement);
      return items.findIndex((item) => item === name);
    }
  } catch {
    return -1;
  }
  return -1;
}

function accessibleNameOf(element: Element): string {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return ariaLabel.trim();
  }
  return (element.textContent ?? "").trim();
}

interface PreparedCase extends NavigationCase {
  readonly displayLabel: string;
}

/**
 * Generate one `it.each` block running every case in `cases`.
 * Each iteration renders fresh via `setup`, presses the key, asserts the active index.
 *
 * MUST be called inside a `describe(...)` block at the test-file top level — it calls `it.each` directly.
 */
export function testNavigationBehavior(options: TestNavigationBehaviorOptions): void {
  const { setup, items, cases, getActiveIndex } = options;
  const resolveActiveIndex = getActiveIndex ?? ((rendered: RenderResult) => defaultGetActiveIndex(rendered, items));
  const prepared: readonly PreparedCase[] = cases.map((entry) => ({
    ...entry,
    displayLabel: entry.label ?? entry.key,
  }));

  it.each(prepared)(
    "moves focus to item $expectedActiveIndex via $displayLabel",
    async ({ key, expectedActiveIndex, displayLabel }) => {
      const rendered = setup();
      const user = userEvent.setup();

      await user.keyboard(key);

      const actual = resolveActiveIndex(rendered);
      expect(actual, `expected active index ${expectedActiveIndex} via ${displayLabel}`).toBe(expectedActiveIndex);

      rendered.unmount();
    },
  );
}
