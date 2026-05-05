import { describe, it, expect } from "vitest"
import { resolveTabTarget } from "../resolve-tab-target.js"

describe("resolveTabTarget", () => {
  function makeContainer(items: { value: string; disabled?: boolean }[]) {
    const container = document.createElement("div")
    for (const item of items) {
      const el = document.createElement("div")
      el.setAttribute("role", "radio")
      el.setAttribute("data-value", item.value)
      if (item.disabled) el.setAttribute("aria-disabled", "true")
      container.appendChild(el)
    }
    return container
  }

  it("returns true when item is active", () => {
    expect(resolveTabTarget(true, true, null, "a")).toBe(true)
  })

  it("returns false for non-active item when another is selected", () => {
    const container = makeContainer([{ value: "a" }, { value: "b" }])
    expect(resolveTabTarget(false, true, container, "b")).toBe(false)
  })

  it("skips aria-disabled items and targets first enabled item", () => {
    const container = makeContainer([
      { value: "a", disabled: true },
      { value: "b" },
      { value: "c" },
    ])
    expect(resolveTabTarget(false, false, container, "a")).toBe(false)
    expect(resolveTabTarget(false, false, container, "b")).toBe(true)
    expect(resolveTabTarget(false, false, container, "c")).toBe(false)
  })

  it("targets first item when no items are disabled", () => {
    const container = makeContainer([
      { value: "a" },
      { value: "b" },
      { value: "c" },
    ])
    expect(resolveTabTarget(false, false, container, "a")).toBe(true)
    expect(resolveTabTarget(false, false, container, "b")).toBe(false)
  })

  it("returns true when no container and no selection (pre-DOM)", () => {
    expect(resolveTabTarget(false, false, null, "a")).toBe(true)
  })

  it("supports custom role parameter", () => {
    const container = document.createElement("div")
    const tab = document.createElement("div")
    tab.setAttribute("role", "tab")
    tab.setAttribute("data-value", "t1")
    container.appendChild(tab)
    expect(resolveTabTarget(false, false, container, "t1", "tab")).toBe(true)
  })
})
