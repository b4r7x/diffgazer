import { describe, expect, it } from "vitest"
import { getTabFromHash } from "@/components/component-page"

describe("getTabFromHash", () => {
  it("maps known component section hashes to tabs", () => {
    expect(getTabFromHash("#component-installation")).toBe("usage")
    expect(getTabFromHash("#component-usage")).toBe("usage")
    expect(getTabFromHash("#component-examples")).toBe("examples")
    expect(getTabFromHash("#component-api")).toBe("api")
    expect(getTabFromHash("#component-accessibility")).toBe("accessibility")
  })

  it("returns null for unknown or invalid hashes", () => {
    expect(getTabFromHash("#unknown-section")).toBeNull()
    expect(getTabFromHash("")).toBeNull()
  })

  it("maps hashes without # prefix (TanStack Router format)", () => {
    expect(getTabFromHash("component-installation")).toBe("usage")
    expect(getTabFromHash("component-usage")).toBe("usage")
    expect(getTabFromHash("component-examples")).toBe("examples")
    expect(getTabFromHash("component-api")).toBe("api")
    expect(getTabFromHash("component-accessibility")).toBe("accessibility")
    expect(getTabFromHash("unknown-section")).toBeNull()
  })

  it("supports URL-encoded hashes", () => {
    expect(getTabFromHash("#component-api%20")).toBeNull()
    expect(getTabFromHash("#component-api")).toBe("api")
  })
})
