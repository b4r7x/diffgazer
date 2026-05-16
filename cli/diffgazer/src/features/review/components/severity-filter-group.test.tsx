import assert from "node:assert/strict";
import test, { describe, afterEach } from "node:test";
import { useState } from "react";
import { render, cleanup } from "ink-testing-library";
import { SEVERITY_ORDER, type UISeverityFilter } from "@diffgazer/core/schemas/ui";
import { CliThemeProvider } from "../../../theme/theme-context.js";
import { SeverityFilterGroup } from "./severity-filter-group.js";

const ARROW_RIGHT = "[C";

const ZERO_COUNTS = SEVERITY_ORDER.reduce(
  (acc, severity) => ({ ...acc, [severity]: 0 }),
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
    const { stdin } = render(<Harness onChange={(next) => (latest = next)} />);
    await flush();

    stdin.write("\r");
    await flush();

    assert.equal(latest.size, 1);
    assert.ok(latest.has(SEVERITY_ORDER[0]));
  });

  test("ArrowRight moves the highlight to the next severity, and Space toggles it", async () => {
    let latest: UISeverityFilter = new Set();
    const { stdin } = render(<Harness onChange={(next) => (latest = next)} />);
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(" ");
    await flush();

    assert.equal(latest.size, 1);
    assert.ok(latest.has(SEVERITY_ORDER[1]));
  });

  test("Enter on the Reset chip clears all selected severities", async () => {
    let latest: UISeverityFilter = new Set();
    const initial = new Set([SEVERITY_ORDER[0], SEVERITY_ORDER[1]]);
    const { stdin } = render(
      <Harness initialFilter={initial} onChange={(next) => (latest = next)} />,
    );
    await flush();

    for (let i = 0; i < SEVERITY_ORDER.length; i += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    stdin.write("\r");
    await flush();

    assert.equal(latest.size, 0);
  });

  test("r shortcut clears all selected severities", async () => {
    let latest: UISeverityFilter = new Set([SEVERITY_ORDER[0]]);
    const { stdin } = render(
      <Harness initialFilter={latest} onChange={(next) => (latest = next)} />,
    );
    await flush();

    stdin.write("r");
    await flush();

    assert.equal(latest.size, 0);
  });
});
