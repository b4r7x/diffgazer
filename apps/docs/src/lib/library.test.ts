import { describe, expect, it } from "vitest";
import { getConsumptionMetadata } from "@/lib/consumption-metadata";
import {
  type DocsLibraryId,
  getInstallCommand,
  routeSlugsFromSourcePath,
  sourceSlugsForLibrary,
} from "@/lib/library";

describe("docs-library id typing", () => {
  it("rejects unknown library ids at compile time", () => {
    const valid: DocsLibraryId = "ui";
    // @ts-expect-error DocsLibraryId is a literal union, not plain string
    const invalid: DocsLibraryId = "totally-not-a-library";
    expect(valid).toBe("ui");
    expect(invalid).toBe("totally-not-a-library");
  });
});

describe("docs-library source path mapping", () => {
  it("prefixes source slugs by library id", () => {
    expect(sourceSlugsForLibrary("ui", ["components", "button"])).toEqual([
      "ui",
      "components",
      "button",
    ]);
    expect(sourceSlugsForLibrary("keys", ["guides", "navigation"])).toEqual([
      "keys",
      "guides",
      "navigation",
    ]);
  });

  it("uses library defaults when route slugs are empty", () => {
    expect(sourceSlugsForLibrary("ui", [])).toEqual(["ui", "getting-started", "installation"]);
    expect(sourceSlugsForLibrary("keys", [])).toEqual(["keys", "getting-started", "installation"]);
  });

  it("maps source paths to route slugs only for the active library", () => {
    expect(routeSlugsFromSourcePath("ui", "/docs/ui/components/button")).toEqual([
      "components",
      "button",
    ]);
    expect(routeSlugsFromSourcePath("keys", "/docs/keys/guides/navigation")).toEqual([
      "guides",
      "navigation",
    ]);
    expect(routeSlugsFromSourcePath("ui", "/docs/keys/guides/navigation")).toBeNull();
    expect(routeSlugsFromSourcePath("keys", "/docs/ui/components/button")).toBeNull();
  });

  it("generates local install commands while packages are unpublished", () => {
    expect(getInstallCommand("ui", "button")).toBe("pnpm exec dgadd add ui/button");
    expect(getInstallCommand("ui", "ui/button")).toBe("pnpm exec dgadd add ui/button");
    expect(getInstallCommand("keys", "navigation")).toBe("pnpm exec dgadd add keys/navigation");
    expect(getInstallCommand("app", "installation")).toBeNull();
  });

  it("keeps consumption metadata dgadd commands on the install-command path", () => {
    const meta = getConsumptionMetadata("ui", "button", "component");

    expect(meta.paths.dgadd.command).toBe(getInstallCommand("ui", "ui/button"));
  });
});
