import { afterEach, describe, expect, it, vi } from "vitest";

const { openMock } = vi.hoisted(() => ({ openMock: vi.fn(() => Promise.resolve()) }));
vi.mock("open", () => ({ default: openMock }));

import { createReadyHandler } from "./server-factories";

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createReadyHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    openMock.mockClear();
  });

  it("prints the server URL on ready without opening the browser in headless mode", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createReadyHandler(false)("http://localhost:3000");
    await flushMicrotasks();

    expect(log).toHaveBeenCalledWith("Diffgazer is running at http://localhost:3000");
    expect(openMock).not.toHaveBeenCalled();
  });

  it("prints the server URL and opens the browser when auto-open is enabled", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createReadyHandler(true)("http://localhost:4000");
    await flushMicrotasks();

    expect(log).toHaveBeenCalledWith("Diffgazer is running at http://localhost:4000");
    expect(openMock).toHaveBeenCalledWith("http://localhost:4000");
  });
});
