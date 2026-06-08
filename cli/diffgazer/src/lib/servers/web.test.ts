import { describe, expect, it } from "vitest";
import { resolveViteReadyAddress } from "./web";

describe("resolveViteReadyAddress", () => {
  it("uses the actual Local URL when Vite falls back to another port", () => {
    const output =
      "Port 3001 is in use, trying another one...\n  ➜  Local:   http://localhost:3002/\n";

    expect(resolveViteReadyAddress(output, "http://localhost:3001")).toBe("http://localhost:3002");
  });

  it("falls back to the requested port when Vite does not print a Local URL", () => {
    expect(resolveViteReadyAddress("starting vite", "http://localhost:3001")).toBe(
      "http://localhost:3001",
    );
  });
});
