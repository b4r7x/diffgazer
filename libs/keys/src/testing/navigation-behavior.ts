import type { RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

/** One keyboard navigation case for `testNavigationBehavior`. */
export interface NavigationCase {
  /** Keyboard input passed to `userEvent.keyboard`. */
  readonly key: string;
  /** Expected active item index after the key is pressed. */
  readonly expectedActiveIndex: number;
  /** Optional label used in the generated test name. */
  readonly label?: string;
}

/** Options for generating shared navigation behavior tests. */
export interface TestNavigationBehaviorOptions {
  /** Renders the component under test and returns its Testing Library result. */
  readonly setup: () => RenderResult;
  /** Accessible item names in navigation order. */
  readonly items: readonly string[];
  /** Expected active index before each keyboard case runs. */
  readonly initialActive?: number;
  /** Keyboard cases to run. */
  readonly cases: readonly NavigationCase[];
  /** Custom active-index resolver for components that do not expose focus directly. */
  readonly getActiveIndex?: (rendered: RenderResult) => number;
}

function defaultGetActiveIndex(rendered: RenderResult, items: readonly string[]): number {
  const activeDescendantHost = rendered.container.querySelector("[aria-activedescendant]");
  if (activeDescendantHost) {
    const activeId = activeDescendantHost.getAttribute("aria-activedescendant");
    if (activeId) {
      const target = activeDescendantHost.ownerDocument.getElementById(activeId);
      if (target) {
        const index = getItemIndex(target, items);
        if (index >= 0) {
          return index;
        }
      }
    }
  }

  const activeElement = rendered.container.ownerDocument.activeElement;
  if (activeElement instanceof HTMLElement) {
    return getItemIndex(activeElement, items);
  }
  return -1;
}

function getItemIndex(element: Element, items: readonly string[]): number {
  const value = element.getAttribute("data-value");
  if (value !== null) {
    const index = items.indexOf(value);
    if (index >= 0) {
      return index;
    }
  }
  return items.indexOf(accessibleNameOf(element));
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

// Must be called inside a describe() block -- it calls it.each directly.
/** Defines one generated test per navigation case inside the current describe block. */
export function testNavigationBehavior(options: TestNavigationBehaviorOptions): void {
  const { setup, items, initialActive, cases, getActiveIndex } = options;
  const resolveActiveIndex =
    getActiveIndex ?? ((rendered: RenderResult) => defaultGetActiveIndex(rendered, items));
  const prepared: readonly PreparedCase[] = cases.map((entry) => ({
    ...entry,
    displayLabel: entry.label ?? entry.key,
  }));

  it.each(prepared)("moves focus to item $expectedActiveIndex via $displayLabel", async ({
    key,
    expectedActiveIndex,
    displayLabel,
  }) => {
    const rendered = setup();
    const user = userEvent.setup();

    if (initialActive !== undefined) {
      expect(
        resolveActiveIndex(rendered),
        `expected initial active index ${initialActive} before ${displayLabel}`,
      ).toBe(initialActive);
    }

    await user.keyboard(key);

    const actual = resolveActiveIndex(rendered);
    expect(actual, `expected active index ${expectedActiveIndex} via ${displayLabel}`).toBe(
      expectedActiveIndex,
    );

    rendered.unmount();
  });
}
