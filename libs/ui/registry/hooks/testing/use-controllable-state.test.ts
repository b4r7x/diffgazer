import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useControllableState } from "../use-controllable-state.js"

describe("useControllableState", () => {
  it("uncontrolled mode returns defaultValue and updates on setState", () => {
    const { result } = renderHook(() =>
      useControllableState({ defaultValue: "a" }),
    )

    expect(result.current[0]).toBe("a")

    act(() => {
      result.current[1]("b")
    })

    expect(result.current[0]).toBe("b")
  })

  it("controlled mode returns value prop and ignores internal state", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useControllableState({ value, defaultValue: "default" }),
      { initialProps: { value: "controlled" } },
    )

    expect(result.current[0]).toBe("controlled")

    act(() => {
      result.current[1]("ignored")
    })

    // internal state should not change since it's controlled
    expect(result.current[0]).toBe("controlled")

    rerender({ value: "updated" })
    expect(result.current[0]).toBe("updated")
  })

  it("onChange callback fires with resolved value", () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useControllableState({ defaultValue: 0, onChange }),
    )

    act(() => {
      result.current[1](42)
    })

    expect(onChange).toHaveBeenCalledWith(42)
  })

  it("function updater receives current value and resolves correctly", () => {
    const { result } = renderHook(() =>
      useControllableState({ defaultValue: 10 }),
    )

    act(() => {
      result.current[1]((prev) => prev + 5)
    })

    expect(result.current[0]).toBe(15)
  })

  it("returns controlled flag as third element", () => {
    const { result: uncontrolled } = renderHook(() =>
      useControllableState({ defaultValue: "x" }),
    )
    expect(uncontrolled.current[2]).toBe(false)

    const { result: controlled } = renderHook(() =>
      useControllableState({ value: "x", defaultValue: "y" }),
    )
    expect(controlled.current[2]).toBe(true)
  })
})
