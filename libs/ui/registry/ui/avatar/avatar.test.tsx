import { render, screen, fireEvent } from "@testing-library/react"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Avatar } from "./index.js"

describe("Avatar", () => {
  // --- Behavioral: image load lifecycle ---

  it("shows fallback until image loads, hides it on success, shows it on error", () => {
    const { unmount } = render(<Avatar src="https://example.com/avatar.jpg" fallback="AB" />)
    // Fallback visible while loading
    expect(screen.getByText("AB")).toBeInTheDocument()
    // Hides after successful load
    fireEvent.load(document.querySelector("img")!)
    expect(screen.queryByText("AB")).not.toBeInTheDocument()
    unmount()

    // Shows fallback on error
    render(<Avatar src="https://example.com/bad.jpg" fallback="AB" />)
    fireEvent.error(document.querySelector("img")!)
    expect(screen.getByText("AB")).toBeInTheDocument()
  })

  it("does not call onStatusChange when no src is provided", () => {
    const onStatusChange = vi.fn()
    render(<Avatar fallback="AB" onStatusChange={onStatusChange} />)
    expect(screen.getByText("AB")).toBeInTheDocument()
    expect(onStatusChange).not.toHaveBeenCalled()
  })

  it("calls onStatusChange through loading, loaded, and error lifecycle", () => {
    const onStatusChange = vi.fn()
    const { unmount } = render(
      <Avatar src="https://example.com/avatar.jpg" alt="User" fallback="AB" onStatusChange={onStatusChange} />,
    )
    expect(onStatusChange).toHaveBeenCalledWith("loading")
    fireEvent.load(document.querySelector("img")!)
    expect(onStatusChange).toHaveBeenCalledWith("loaded")
    unmount()

    const onStatusChange2 = vi.fn()
    render(
      <Avatar src="https://example.com/bad.jpg" alt="User" fallback="AB" onStatusChange={onStatusChange2} />,
    )
    fireEvent.error(document.querySelector("img")!)
    expect(onStatusChange2).toHaveBeenCalledWith("error")
  })

  it("renders default fallback '?' when no fallback prop given", () => {
    render(<Avatar />)
    expect(screen.getByText("?")).toBeInTheDocument()
  })

  it("AvatarGroup renders overflow indicator when max is exceeded", () => {
    render(
      <Avatar.Group size="md" max={2}>
        <Avatar fallback="A" alt="A" />
        <Avatar fallback="B" alt="B" />
        <Avatar fallback="C" alt="C" />
        <Avatar fallback="D" alt="D" />
      </Avatar.Group>,
    )
    expect(screen.getByLabelText("2 more")).toBeInTheDocument()
  })

  // --- Accessibility ---

  it("passes axe accessibility check", async () => {
    const { container } = render(<Avatar alt="Jane Doe" fallback="JD" />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("passes axe check for AvatarGroup", async () => {
    const { container } = render(
      <Avatar.Group size="md" max={2}>
        <Avatar alt="Alice" fallback="A" />
        <Avatar alt="Bob" fallback="B" />
        <Avatar alt="Charlie" fallback="C" />
      </Avatar.Group>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
