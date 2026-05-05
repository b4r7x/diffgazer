import { describe, expect, it } from "vitest"
import {
  routeSlugsFromSourcePath,
  sourceSlugsForLibrary,
} from "@/lib/docs-library"

describe("docs-library source path mapping", () => {
  it("prefixes source slugs by library id", () => {
    expect(sourceSlugsForLibrary("ui", ["components", "button"])).toEqual([
      "ui",
      "components",
      "button",
    ])
    expect(sourceSlugsForLibrary("keys", ["guides", "navigation"])).toEqual([
      "keys",
      "guides",
      "navigation",
    ])
  })

  it("uses library defaults when route slugs are empty", () => {
    expect(sourceSlugsForLibrary("ui", [])).toEqual([
      "ui",
      "getting-started",
      "installation",
    ])
    expect(sourceSlugsForLibrary("keys", [])).toEqual([
      "keys",
      "getting-started",
      "installation",
    ])
  })

  it("maps source paths to route slugs only for the active library", () => {
    expect(routeSlugsFromSourcePath("ui", "/docs/ui/components/button")).toEqual([
      "components",
      "button",
    ])
    expect(routeSlugsFromSourcePath("keys", "/docs/keys/guides/navigation")).toEqual([
      "guides",
      "navigation",
    ])
    expect(routeSlugsFromSourcePath("ui", "/docs/keys/guides/navigation")).toBeNull()
    expect(routeSlugsFromSourcePath("keys", "/docs/ui/components/button")).toBeNull()
  })
})
