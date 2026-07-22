import { setImmediate as waitImmediate } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

const { openMock } = vi.hoisted(() => ({ openMock: vi.fn(() => Promise.resolve()) }));
// Boundary mock: OS browser opener.
vi.mock("open", () => ({ default: openMock }));

import { createReadyHandler, openBrowserAddress } from "./browser-launch";

describe("createReadyHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    openMock.mockClear();
  });

  it("prints the server URL on ready without opening the browser in headless mode", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createReadyHandler(false)("http://localhost:3000");

    expect(log).toHaveBeenCalledWith("Diffgazer is running at http://localhost:3000");
    expect(openMock).not.toHaveBeenCalled();
  });

  it("opens the actual Vite address when auto-open is enabled", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createReadyHandler(true)("http://localhost:3002");
    await vi.waitFor(() => {
      expect(log).toHaveBeenCalledWith("Diffgazer is running at http://localhost:3002");
      expect(openMock).toHaveBeenCalledWith("http://localhost:3002");
    });
  });
});

describe("openBrowserAddress", () => {
  it("warns when opening the browser fails", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;

    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    try {
      openBrowserAddress("http://localhost:3000", () =>
        Promise.reject(new Error("launcher unavailable")),
      );
      await waitImmediate();
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings).toEqual([
      "Could not open browser at http://localhost:3000: launcher unavailable",
    ]);
  });
});
