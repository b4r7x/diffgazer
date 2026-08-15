import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EXAMPLE_FRAME_OVERRIDES, resolvePreviewFrame } from "@/lib/example-frames";

const EXAMPLES_ROOT = resolve(import.meta.dirname, "../../registry/examples");

function readExampleNames(): string[] {
  return readdirSync(EXAMPLES_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => entry.name.replace(/\.tsx$/, ""));
}

describe("resolvePreviewFrame", () => {
  it("names only examples that exist under registry/examples", () => {
    const exampleNames = new Set(readExampleNames());
    const missing = Object.keys(EXAMPLE_FRAME_OVERRIDES).filter((name) => !exampleNames.has(name));

    expect(missing).toEqual([]);
  });

  it("falls back to the default frame for unlisted examples", () => {
    expect(resolvePreviewFrame("button-default")).toBe("default");
  });
});
