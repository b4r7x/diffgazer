import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { SearchInput } from "./index.js"

function renderSearchInput(props: Record<string, unknown> = {}) {
  return render(<SearchInput aria-label="Search" {...props} />)
}

describe("SearchInput", () => {
  it("updates value when typing (uncontrolled)", async () => {
    renderSearchInput()
    const input = screen.getByRole("searchbox")
    await userEvent.type(input, "hello")
    expect(input).toHaveValue("hello")
  })

  it("fires onChange in controlled mode", async () => {
    const onChange = vi.fn()
    renderSearchInput({ value: "", onChange })
    const input = screen.getByRole("searchbox")
    await userEvent.type(input, "a")
    expect(onChange).toHaveBeenCalledWith("a")
  })

  it("calls onEscape when Escape is pressed", async () => {
    const onEscape = vi.fn()
    renderSearchInput({ onEscape })
    const input = screen.getByRole("searchbox")
    input.focus()
    await userEvent.keyboard("{Escape}")
    expect(onEscape).toHaveBeenCalledOnce()
  })

  it("calls onEnter when Enter is pressed", async () => {
    const onEnter = vi.fn()
    renderSearchInput({ onEnter })
    const input = screen.getByRole("searchbox")
    input.focus()
    await userEvent.keyboard("{Enter}")
    expect(onEnter).toHaveBeenCalledOnce()
  })

  it("forwards custom onKeyDown alongside built-in handler", async () => {
    const onKeyDown = vi.fn()
    renderSearchInput({ onKeyDown })
    const input = screen.getByRole("searchbox")
    input.focus()
    await userEvent.keyboard("{Enter}")
    expect(onKeyDown).toHaveBeenCalledOnce()
  })

  it("has no a11y violations", async () => {
    const { container } = renderSearchInput()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations when disabled", async () => {
    const { container } = renderSearchInput({ disabled: true })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("sets aria-invalid in error state", () => {
    renderSearchInput({ error: true })
    expect(screen.getByRole("searchbox")).toHaveAttribute("aria-invalid", "true")
  })
})
