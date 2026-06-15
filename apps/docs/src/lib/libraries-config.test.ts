import { describe, expect, it } from "vitest";
import { DocsLibrariesConfigSchema } from "./libraries-config";

const baseLibrary = {
  id: "ui",
  displayName: "@diffgazer/ui",
  logoText: "@diffgazer/ui",
  githubUrl: "https://github.com/b4r7x/diffgazer/tree/main/libs/ui",
  enabled: true,
  defaultRouteSlugs: ["getting-started"],
};

describe("DocsLibrariesConfigSchema", () => {
  it("accepts a config whose primaryLibraryId matches a library id", () => {
    const result = DocsLibrariesConfigSchema.safeParse({
      primaryLibraryId: "ui",
      libraries: [baseLibrary],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a config whose primaryLibraryId matches no library id", () => {
    const result = DocsLibrariesConfigSchema.safeParse({
      primaryLibraryId: "missing",
      libraries: [baseLibrary],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["primaryLibraryId"]);
  });
});
