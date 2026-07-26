import { describe, expect, it } from "vitest";
import { parseKeysDependencyRef } from "./registry-types.js";

describe("parseKeysDependencyRef", () => {
  it.each([
    ["@diffgazer-keys/focus-trap", "focus-trap"],
    ["@diffgazer/keys/focus-trap", "focus-trap"],
  ])("returns the bare hook name for %s", (dependency, hook) => {
    expect(parseKeysDependencyRef(dependency)).toBe(hook);
  });

  it.each([
    "button",
    "@diffgazer/keys",
    "@diffgazer-keysX/focus-trap",
    "https://r.b4r7.dev/r/ui",
  ])("returns null for non-keys dependency %s", (dependency) => {
    expect(parseKeysDependencyRef(dependency)).toBeNull();
  });
});
