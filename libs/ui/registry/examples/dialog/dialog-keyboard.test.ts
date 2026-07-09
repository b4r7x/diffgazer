import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "dialog-keyboard.tsx"), "utf-8");

describe("dialog-keyboard example copy contract", () => {
  it("imports keys helpers from the local copy-mode hook path, not the unpublished package", () => {
    expect(source).not.toContain('from "@diffgazer/keys"');
    expect(source).toContain('from "@/hooks/use-navigation"');
  });
});
