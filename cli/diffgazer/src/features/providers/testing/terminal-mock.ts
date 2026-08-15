import { afterEach, vi } from "vitest";

const terminalDimensions = vi.hoisted(() => ({
  current: { columns: 80, rows: 24 },
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

// The overlays read the zone GlobalLayout provides, which these harnesses do
// not mount. Derive it from the mocked terminal with the real row math.
vi.mock("../../../components/layout/global", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../components/layout/global")>();
  return {
    ...actual,
    useContentZone: () => ({
      columns: terminalDimensions.current.columns,
      contentColumns: terminalDimensions.current.columns,
      contentRows: actual.getContentZoneRows(terminalDimensions.current.rows),
    }),
  };
});

export function setTestTerminalDimensions(dimensions: { columns: number; rows: number }): void {
  terminalDimensions.current = dimensions;
}

afterEach(() => {
  terminalDimensions.current = { columns: 80, rows: 24 };
});
