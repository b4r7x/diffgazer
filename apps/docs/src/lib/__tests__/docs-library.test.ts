import { describe, expect, it } from "vitest"
import {
  routeSlugsFromSourcePath,
  sourceSlugsForLibrary,
} from "@/lib/docs-library"

describe("docs-library source path mapping", () => {
  it("prefixes source slugs by library id", () => {
    expect(sourceSlugsForLibrary("diff-ui", ["components", "button"])).toEqual([
      "diff-ui",
      "components",
      "button",
    ])
    expect(sourceSlugsForLibrary("keyscope", ["guides", "navigation"])).toEqual([
      "keyscope",
      "guides",
      "navigation",
    ])
  })

  it("uses library defaults when route slugs are empty", () => {
    expect(sourceSlugsForLibrary("diff-ui", [])).toEqual([
      "diff-ui",
      "getting-started",
      "installation",
    ])
    expect(sourceSlugsForLibrary("keyscope", [])).toEqual([
      "keyscope",
      "getting-started",
      "installation",
    ])
  })

  it("maps source paths to route slugs only for the active library", () => {
    expect(routeSlugsFromSourcePath("diff-ui", "/docs/diff-ui/components/button")).toEqual([
      "components",
      "button",
    ])
    expect(routeSlugsFromSourcePath("keyscope", "/docs/keyscope/guides/navigation")).toEqual([
      "guides",
      "navigation",
    ])
    expect(routeSlugsFromSourcePath("diff-ui", "/docs/keyscope/guides/navigation")).toBeNull()
    expect(routeSlugsFromSourcePath("keyscope", "/docs/diff-ui/components/button")).toBeNull()
  })
})
