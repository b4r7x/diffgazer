import { describe, expect, test } from "vitest";
import { getInstallBaseForFilePath, getInstallDirForBase } from "./registry.js";

describe("getInstallBaseForFilePath", () => {
  test("returns components for registry/ui paths", () => {
    expect(getInstallBaseForFilePath("registry/ui/button.tsx")).toBe("components");
  });

  test("returns hooks for registry/hooks paths", () => {
    expect(getInstallBaseForFilePath("registry/hooks/use-presence.ts")).toBe("hooks");
  });

  test("returns lib for registry/lib paths", () => {
    expect(getInstallBaseForFilePath("registry/lib/cn.ts")).toBe("lib");
  });

  test("returns styles for styles paths (theme registry item)", () => {
    expect(getInstallBaseForFilePath("styles/theme-base.css")).toBe("styles");
    expect(getInstallBaseForFilePath("styles/theme.css")).toBe("styles");
    expect(getInstallBaseForFilePath("styles/styles.css")).toBe("styles");
  });

  test("throws for unsupported paths", () => {
    expect(() => getInstallBaseForFilePath("registry/unknown/foo.ts")).toThrow(
      /Unsupported registry file path/,
    );
  });
});

describe("getInstallDirForBase", () => {
  const config = {
    componentsFsPath: "src/components/ui",
    hooksFsPath: "src/hooks",
    libFsPath: "src/lib",
    stylesFsPath: "src/styles",
  };

  test("maps components to componentsFsPath", () => {
    expect(getInstallDirForBase("components", config)).toBe("src/components/ui");
  });

  test("maps hooks to hooksFsPath", () => {
    expect(getInstallDirForBase("hooks", config)).toBe("src/hooks");
  });

  test("maps lib to libFsPath", () => {
    expect(getInstallDirForBase("lib", config)).toBe("src/lib");
  });

  test("maps styles to stylesFsPath", () => {
    expect(getInstallDirForBase("styles", config)).toBe("src/styles");
  });
});
