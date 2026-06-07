import {
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type UISeverityFilter,
} from "@diffgazer/core/schemas/presentation";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../app/providers/theme";
import { SeverityFilterGroup } from "./severity-filter-group";

const ARROW_RIGHT = "[C";

const ZERO_COUNTS = SEVERITY_ORDER.reduce(
  (acc, severity) => {
    acc[severity] = 0;
    return acc;
  },
  {} as Record<(typeof SEVERITY_ORDER)[number], number>,
);

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function Harness({
  initialFilter = new Set<(typeof SEVERITY_ORDER)[number]>(),
  onChange,
}: {
  initialFilter?: UISeverityFilter;
  onChange?: (filter: UISeverityFilter) => void;
}) {
  const [filter, setFilter] = useState<UISeverityFilter>(initialFilter);
  return (
    <CliThemeProvider initialTheme="dark">
      <SeverityFilterGroup
        currentFilter={filter}
        onFilterChange={(next) => {
          setFilter(next);
          onChange?.(next);
        }}
        issueCounts={ZERO_COUNTS}
        isActive
      />
    </CliThemeProvider>
  );
}

describe("CLI SeverityFilterGroup keyboard model", () => {
  afterEach(() => {
    cleanup();
  });

  test("Enter toggles the focused severity into the filter set", async () => {
    let latest: UISeverityFilter = new Set();
    const { stdin } = render(
      <Harness
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    await flush();

    stdin.write("\r");
    await flush();

    expect(latest.size).toBe(1);
    expect(latest.has(SEVERITY_ORDER[0])).toBeTruthy();
  });

  test("ArrowRight moves the highlight to the next severity, and Space toggles it", async () => {
    let latest: UISeverityFilter = new Set();
    const { stdin } = render(
      <Harness
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(" ");
    await flush();

    expect(latest.size).toBe(1);
    expect(latest.has(SEVERITY_ORDER[1])).toBeTruthy();
  });

  test("Enter on the Reset chip clears all selected severities", async () => {
    let latest: UISeverityFilter = new Set();
    const initial = new Set([SEVERITY_ORDER[0], SEVERITY_ORDER[1]]);
    const { stdin } = render(
      <Harness
        initialFilter={initial}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    await flush();

    for (let i = 0; i < SEVERITY_ORDER.length; i += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    stdin.write("\r");
    await flush();

    expect(latest.size).toBe(0);
  });

  test("r shortcut clears all selected severities", async () => {
    let latest: UISeverityFilter = new Set([SEVERITY_ORDER[0]]);
    const { stdin } = render(
      <Harness
        initialFilter={latest}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    await flush();

    stdin.write("r");
    await flush();

    expect(latest.size).toBe(0);
  });
});

describe("CLI SeverityFilterGroup focus clamping", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderControlled(filter: UISeverityFilter, onFilterChange = vi.fn()) {
    const ui = (currentFilter: UISeverityFilter) => (
      <CliThemeProvider initialTheme="dark">
        <SeverityFilterGroup
          currentFilter={currentFilter}
          onFilterChange={onFilterChange}
          issueCounts={ZERO_COUNTS}
          isActive
        />
      </CliThemeProvider>
    );
    const result = render(ui(filter));
    return {
      ...result,
      onFilterChange,
      rerenderWith: (next: UISeverityFilter) => result.rerender(ui(next)),
    };
  }

  test("clamps the focused index when the Reset chip disappears after an external filter clear", async () => {
    const allSelected = new Set(SEVERITY_ORDER);
    const { stdin, lastFrame, rerenderWith, onFilterChange } = renderControlled(allSelected);
    await flush();

    // Move focus onto the Reset chip (index === SEVERITY_ORDER.length).
    for (let i = 0; i < SEVERITY_ORDER.length; i += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    expect(lastFrame()).toContain("[Reset]");

    // Parent clears the filter externally: the Reset chip is gone and maxIndex
    // shrinks, so the stored index now exceeds it.
    rerenderWith(new Set());
    await flush();
    expect(lastFrame()).not.toContain("[Reset]");

    // Enter must act on the clamped last severity, not the now-absent Reset chip.
    onFilterChange.mockClear();
    stdin.write("\r");
    await flush();

    const lastSeverity = SEVERITY_ORDER.at(-1);
    if (lastSeverity === undefined) throw new Error("SEVERITY_ORDER is empty");
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    const firstCall = onFilterChange.mock.calls[0];
    if (firstCall === undefined) throw new Error("onFilterChange was not called");
    const nextFilter = firstCall[0] as UISeverityFilter;
    expect(nextFilter.has(lastSeverity)).toBe(true);
  });

  test("does not emit a setState-in-render warning while the index is clamped", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const allSelected = new Set(SEVERITY_ORDER);
    const { stdin, lastFrame, rerenderWith } = renderControlled(allSelected);
    await flush();

    for (let i = 0; i < SEVERITY_ORDER.length; i += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    rerenderWith(new Set());
    await flush();

    expect(consoleError).not.toHaveBeenCalled();
    // Component still renders its severities after the clamp.
    expect(lastFrame()).toContain(SEVERITY_LABELS[SEVERITY_ORDER[0]]);
  });
});
