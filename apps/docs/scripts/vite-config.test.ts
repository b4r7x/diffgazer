import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Docs Vite aliases", () => {
  it("resolves accessible text to the UI registry before the Docs source alias", async () => {
    const configSource = await readFile(resolve(import.meta.dirname, "../vite.config.ts"), "utf8");
    const accessibleTextAlias = '"@/lib/accessible-text": uiRegistryPath("lib/accessible-text"),';
    const docsSourceAlias = '"@": resolve(import.meta.dirname, "./src"),';
    const configLines = configSource.split("\n").map((line) => line.trim());
    const accessibleTextIndex = configLines.indexOf(accessibleTextAlias);
    const docsSourceIndex = configLines.indexOf(docsSourceAlias);

    expect(accessibleTextIndex).toBeGreaterThanOrEqual(0);
    expect(docsSourceIndex).toBeGreaterThan(accessibleTextIndex);
  });
});
