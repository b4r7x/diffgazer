import { describe, expect, test, vi } from "vitest";
import { ctx } from "../../context.js";
import { buildInstallRequiresByItem } from "./install-requires.js";

describe("buildInstallRequiresByItem", () => {
  test("records ui registry dependencies and copy-mode keys hooks on owners", () => {
    const resolveDeps = vi.spyOn(ctx.registry, "resolveDeps");
    resolveDeps.mockReturnValue(["button", "spinner", "theme", "utils"]);

    const requiresByItem = buildInstallRequiresByItem(["button"], [], "copy");

    expect(requiresByItem.get("ui/button")).toEqual(
      expect.arrayContaining(["ui/spinner", "ui/theme", "ui/utils"]),
    );
    expect(requiresByItem.get("ui/button")?.length).toBe(3);

    resolveDeps.mockRestore();
  });

  test("records copy-mode keys hooks for dialog-shell from the live registry", () => {
    const requiresByItem = buildInstallRequiresByItem(["dialog-shell"], [], "copy");

    const requires = requiresByItem.get("ui/dialog-shell") ?? [];
    expect(requires).toContain("keys/focus-trap");
    expect(requires.some((name) => name.startsWith("ui/"))).toBe(true);
    expect(requiresByItem.has("keys/focus-trap")).toBe(false);
  });

  test("records an explicit empty edge list for zero-dependency items", () => {
    const resolveDeps = vi.spyOn(ctx.registry, "resolveDeps");
    resolveDeps.mockReturnValue(["controllable-state"]);

    const requiresByItem = buildInstallRequiresByItem(["controllable-state"], [], "none");

    expect(requiresByItem.get("ui/controllable-state")).toEqual([]);

    resolveDeps.mockRestore();
  });

  test("omits keys hooks for package integration mode", () => {
    const resolveDeps = vi.spyOn(ctx.registry, "resolveDeps");
    resolveDeps.mockReturnValue(["dialog-shell", "theme", "utils"]);

    const requiresByItem = buildInstallRequiresByItem(["dialog-shell"], [], "@diffgazer/keys");

    const requires = requiresByItem.get("ui/dialog-shell") ?? [];
    expect(requires.every((name) => name.startsWith("ui/"))).toBe(true);
    expect(requires).not.toContain("keys/focus-trap");

    resolveDeps.mockRestore();
  });
});
