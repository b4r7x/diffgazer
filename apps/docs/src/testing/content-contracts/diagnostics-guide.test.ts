import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getContextActionLabel,
  getContextPresentation,
} from "@diffgazer/core/schemas/presentation";
import { describe, expect, it } from "vitest";

const guide = readFileSync(
  resolve(import.meta.dirname, "../../../content/docs/app/web/diagnostics.mdx"),
  "utf8",
);

describe("web diagnostics guide", () => {
  it("documents context row labels from diagnostics presentation helpers", () => {
    for (const status of ["loading", "ready", "missing"] as const) {
      expect(guide).toContain(getContextPresentation(status, null).label);
    }
    expect(getContextPresentation("error", "probe failed").label.startsWith("Error:")).toBe(true);
    expect(guide).toContain("**Error:**");
  });

  it("documents context action labels from getContextActionLabel", () => {
    expect(guide).toContain(getContextActionLabel(false, "missing"));
    expect(guide).toContain(getContextActionLabel(false, "ready"));
    expect(guide).toContain(getContextActionLabel(true, "ready"));
  });

  it("uses setup missing-field tokens shown in the UI", () => {
    expect(guide).toContain("secrets storage");
    expect(guide).not.toContain("secretsStorage");
  });

  it("does not document stale context copy", () => {
    expect(guide).not.toContain("Working...");
    expect(guide).not.toMatch(/\*\*loading\*\*/i);
    expect(guide).not.toMatch(/\*\*ready\*\*, \*\*missing\*\*, or \*\*error\*\*/i);
  });
});
