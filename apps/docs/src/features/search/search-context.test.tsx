// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SearchProvider, useSearchOpen } from "./search-context"

describe("SearchProvider", () => {
  it("provides open state that consumers can read and update", () => {
    const { result } = renderHook(() => useSearchOpen(), { wrapper: SearchProvider })

    expect(result.current.open).toBe(false)

    act(() => result.current.setOpen(true))
    expect(result.current.open).toBe(true)

    act(() => result.current.setOpen(false))
    expect(result.current.open).toBe(false)
  })

  it("throws when used outside the provider", () => {
    expect(() => renderHook(() => useSearchOpen())).toThrow(/within SearchProvider/)
  })
})
