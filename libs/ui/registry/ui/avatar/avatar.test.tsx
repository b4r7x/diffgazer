import { render, screen, fireEvent } from "@testing-library/react"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Avatar } from "./index.js"

describe("Avatar", () => {
  it("shows fallback until image loads, hides it on success, shows it on error", () => {
    const { unmount } = render(<Avatar src="https://example.com/avatar.jpg" fallback="AB" />)
    expect(screen.getByText("AB")).toBeInTheDocument()
    fireEvent.load(document.querySelector("img")!)
    expect(screen.queryByText("AB")).not.toBeInTheDocument()
    unmount()

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

  it("falls back to text when the fallback image fails", () => {
    render(
      <Avatar src="https://example.com/bad.jpg" fallback="AB">
        <Avatar.Fallback src="https://example.com/fallback.jpg">AB</Avatar.Fallback>
      </Avatar>,
    )

    fireEvent.error(document.querySelector("img")!)
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

  it("hides fallback from accessibility tree when image successfully loads", () => {
    const { container } = render(
      <Avatar src="https://example.com/avatar.jpg" alt="Jane Doe" fallback="JD" />
    )
    expect(screen.getByText("JD")).toBeInTheDocument()

    fireEvent.load(document.querySelector("img")!)
    const fallback = screen.queryByText("JD")
    if (fallback) {
      expect(fallback).toHaveAttribute("aria-hidden", "true")
    }
  })

  it("group with aria-label is accessible", () => {
    const { container } = render(
      <Avatar.Group size="md" max={2} aria-label="Team members">
        <Avatar fallback="A" alt="Alice" />
        <Avatar fallback="B" alt="Bob" />
        <Avatar fallback="C" alt="Charlie" />
      </Avatar.Group>
    )
    const group = container.querySelector("[aria-label='Team members']")
    expect(group).toBeInTheDocument()
  })
})
