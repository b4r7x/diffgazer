import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("routing regressions", () => {
  it("does not register a root splat route that can shadow Vite internal module paths", () => {
    const routeTreePath = resolve(import.meta.dirname, "../../routeTree.gen.ts")
    const routeTreeSource = readFileSync(routeTreePath, "utf-8")

    expect(routeTreeSource).not.toContain("import { Route as SplatRouteImport } from './routes/$'")
    expect(routeTreeSource).not.toContain("'/$': typeof SplatRoute")
  })
})
