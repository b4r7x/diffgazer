import { afterEach, vi } from "vitest";

const terminalDimensions = vi.hoisted(() => ({
  current: { columns: 80, rows: 24 },
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

export function setTestTerminalDimensions(dimensions: { columns: number; rows: number }): void {
  terminalDimensions.current = dimensions;
}

afterEach(() => {
  terminalDimensions.current = { columns: 80, rows: 24 };
});
