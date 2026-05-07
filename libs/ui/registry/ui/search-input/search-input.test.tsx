import { render, screen, waitFor } from "@testing-library/react"
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

  it("honors preventDefault in custom key handlers", async () => {
    const onEnter = vi.fn()
    renderSearchInput({ onEnter, onKeyDown: (event: KeyboardEvent) => event.preventDefault() })
    const input = screen.getByRole("searchbox")
    input.focus()
    await userEvent.keyboard("{Enter}")
    expect(onEnter).not.toHaveBeenCalled()
  })

  it("resets uncontrolled value with native form reset", async () => {
    render(
      <form data-testid="form">
        <SearchInput name="query" aria-label="Search" defaultValue="initial" />
      </form>
    )

    const input = screen.getByRole("searchbox")
    await userEvent.clear(input)
    await userEvent.type(input, "changed")
    expect(input).toHaveValue("changed")

    ;(screen.getByTestId("form") as HTMLFormElement).reset()
    await waitFor(() => expect(input).toHaveValue("initial"))
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

  it("does not style aria-invalid false as invalid", () => {
    const { container } = renderSearchInput({ "aria-invalid": "false" })

    expect(screen.getByRole("searchbox")).toHaveAttribute("aria-invalid", "false")
    expect(container.querySelector("search")).not.toHaveClass("border-destructive")
  })

  it("preserves grammar invalid state", () => {
    const { container } = renderSearchInput({ "aria-invalid": "grammar" })

    expect(screen.getByRole("searchbox")).toHaveAttribute("aria-invalid", "grammar")
    expect(container.querySelector("search")).toHaveClass("border-destructive")
  })
})
