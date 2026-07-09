import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "search-input-keyboard.tsx"), "utf-8");

describe("search-input-keyboard example copy contract", () => {
  it("imports keys helpers from the local copy-mode hook path, not the unpublished package", () => {
    expect(source).not.toContain('from "@diffgazer/keys"');
    expect(source).toContain('from "@/hooks/use-navigation"');
  });

  it("clears the navigation highlight with the documented null sentinel", () => {
    expect(source).toContain("highlight(null)");
    expect(source).not.toContain('highlight("")');
  });
});
