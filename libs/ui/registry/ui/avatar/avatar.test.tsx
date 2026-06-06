import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { axe } from "../../../testing/axe"
import { Card } from "../card/index"
import { Avatar } from "./index"

function getAvatarImage(container: HTMLElement): HTMLImageElement {
  // querySelector retained: <img> has no accessible role until it loads (jsdom never paints it); structural assertion is the contract — the test needs the element to fire load/error against
  const image = container.querySelector("img")
  if (!(image instanceof HTMLImageElement)) throw new Error("Expected avatar image")
  return image
}

describe("Avatar", () => {
  it("shows fallback until image loads, hides it on success, shows it on error", () => {
    const { container, unmount } = render(<Avatar src="https://example.com/avatar.jpg" fallback="AB" />)
    expect(screen.getByText("AB")).toBeInTheDocument()
    // fireEvent retained: native <img> load event has no user-event equivalent
    fireEvent.load(getAvatarImage(container))
    expect(screen.queryByText("AB")).not.toBeInTheDocument()
    unmount()

    const badAvatar = render(<Avatar src="https://example.com/bad.jpg" fallback="AB" />)
    // fireEvent retained: native <img> error event has no user-event equivalent
    fireEvent.error(getAvatarImage(badAvatar.container))
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
    const { container, unmount } = render(
      <Avatar src="https://example.com/avatar.jpg" alt="User" fallback="AB" onStatusChange={onStatusChange} />,
    )
    expect(onStatusChange).toHaveBeenCalledWith("loading")
    // fireEvent retained: native <img> load event has no user-event equivalent
    fireEvent.load(getAvatarImage(container))
    expect(onStatusChange).toHaveBeenCalledWith("loaded")
    unmount()

    const onStatusChange2 = vi.fn()
    const badAvatar = render(
      <Avatar src="https://example.com/bad.jpg" alt="User" fallback="AB" onStatusChange={onStatusChange2} />,
    )
    // fireEvent retained: native <img> error event has no user-event equivalent
    fireEvent.error(getAvatarImage(badAvatar.container))
    expect(onStatusChange2).toHaveBeenCalledWith("error")
  })

  it("does not re-emit the current status when onStatusChange identity changes", () => {
    const firstOnStatusChange = vi.fn()
    const secondOnStatusChange = vi.fn()
    const { container, rerender } = render(
      <Avatar src="https://example.com/avatar.jpg" alt="User" fallback="AB" onStatusChange={firstOnStatusChange} />,
    )

    expect(firstOnStatusChange).toHaveBeenCalledWith("loading")
    // fireEvent retained: native <img> load event has no user-event equivalent
    fireEvent.load(getAvatarImage(container))
    expect(firstOnStatusChange).toHaveBeenCalledWith("loaded")

    rerender(
      <Avatar src="https://example.com/avatar.jpg" alt="User" fallback="AB" onStatusChange={secondOnStatusChange} />,
    )

    expect(secondOnStatusChange).not.toHaveBeenCalled()
  })

  it("resets image status after src changes without render-time state updates", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { container, rerender } = render(
      <Avatar src="https://example.com/avatar.jpg" alt="User" fallback="AB" />,
    )

    // fireEvent retained: native <img> load event has no user-event equivalent
    fireEvent.load(getAvatarImage(container))
    expect(screen.queryByText("AB")).not.toBeInTheDocument()

    rerender(<Avatar src="https://example.com/next.jpg" alt="User" fallback="AB" />)

    await waitFor(() => expect(screen.getByText("AB")).toBeInTheDocument())
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("renders default fallback '?' when no fallback prop given", () => {
    render(<Avatar />)
    expect(screen.getByText("?")).toBeInTheDocument()
  })

  it("falls back to text when the fallback image fails", () => {
    const { container } = render(
      <Avatar src="https://example.com/bad.jpg" fallback="AB">
        <Avatar.Fallback src="https://example.com/fallback.jpg">AB</Avatar.Fallback>
      </Avatar>,
    )

    // fireEvent retained: native <img> error event has no user-event equivalent
    fireEvent.error(getAvatarImage(container))
    expect(screen.getByText("AB")).toBeInTheDocument()
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

  it("provides accessible image when src and alt are provided", () => {
    render(<Avatar src="https://example.com/avatar.jpg" alt="Jane Doe" fallback="JD" />)
    const avatar = screen.getByRole("img", { name: "Jane Doe" })
    expect(avatar).toHaveAttribute("aria-label", "Jane Doe")
  })

  it("uses fallback as accessible text when no image is loaded", () => {
    render(<Avatar fallback="JD" />)
    const fallback = screen.getByText("JD")
    expect(fallback).toBeInTheDocument()
  })

  it("keeps a decorative avatar from overriding its container's accessible name", () => {
    const { container } = render(
      <Card as="article" aria-label="Jane Doe">
        <Avatar src="https://example.com/avatar.jpg" />
        <span>Jane Doe</span>
      </Card>,
    )

    // No alt -> the image is decorative and the avatar root is presentational.
    fireEvent.load(getAvatarImage(container))

    const card = screen.getByRole("article", { name: "Jane Doe" })
    expect(card).toBeInTheDocument()
    expect(getAvatarImage(container)).toHaveAttribute("alt", "")
  })

  it("hides fallback from accessibility tree when image successfully loads", () => {
    const { container } = render(
      <Avatar src="https://example.com/avatar.jpg" alt="Jane Doe" fallback="JD" />
    )
    expect(screen.getByText("JD")).toBeInTheDocument()

    // fireEvent retained: native <img> load event has no user-event equivalent
    fireEvent.load(getAvatarImage(container))
    const fallback = screen.queryByText("JD")
    if (fallback) {
      expect(fallback).toHaveAttribute("aria-hidden", "true")
    }
  })

  it("group with aria-label is accessible", () => {
    render(
      <Avatar.Group size="md" max={2} aria-label="Team members">
        <Avatar fallback="A" alt="Alice" />
        <Avatar fallback="B" alt="Bob" />
        <Avatar fallback="C" alt="Charlie" />
      </Avatar.Group>
    )
    expect(screen.getByLabelText("Team members")).toBeInTheDocument()
  })
})
