// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  Callout,
  CalloutContent,
  CalloutDismiss,
  CalloutIcon,
  CalloutTitle,
} from "@/components/ui/callout"

describe("Callout", () => {
  it("uses grid layout and part markers for column mode", () => {
    const { container } = render(
      <Callout layout="column">
        <CalloutIcon />
        <CalloutTitle>Info</CalloutTitle>
        <CalloutContent>Column layout content.</CalloutContent>
      </Callout>,
    )

    const callout = container.querySelector('[role="status"]')
    expect(callout).not.toBeNull()
    if (!callout) return

    expect(callout.className).toContain("grid")
    expect(callout.className).toContain("grid-cols-[auto_minmax(0,1fr)_auto]")
    expect(callout.querySelector('[data-callout-part="icon"]')).not.toBeNull()
    expect(callout.querySelector('[data-callout-part="title"]')).not.toBeNull()
    expect(callout.querySelector('[data-callout-part="content"]')).not.toBeNull()
  })

  it("uses inline flex layout for inline mode", () => {
    const { container } = render(
      <Callout layout="inline">
        <CalloutIcon />
        <CalloutTitle>Inline</CalloutTitle>
        <CalloutContent>Inline layout content.</CalloutContent>
      </Callout>,
    )

    const callout = container.querySelector('[role="status"]')
    expect(callout).not.toBeNull()
    if (!callout) return

    expect(callout.className).toContain("flex")
    expect(callout.className).toContain("flex-wrap")
    expect(callout.className).not.toContain("grid-cols-[auto_minmax(0,1fr)_auto]")
  })

  it("removes layout styles for none mode", () => {
    const { container } = render(
      <Callout layout="none">
        <CalloutIcon />
        <CalloutTitle>None</CalloutTitle>
        <CalloutContent>No enforced layout.</CalloutContent>
      </Callout>,
    )

    const callout = container.querySelector('[role="status"]')
    expect(callout).not.toBeNull()
    if (!callout) return

    expect(callout.className).not.toContain("grid-cols-[auto_minmax(0,1fr)_auto]")
    expect(callout.className).not.toContain("flex-wrap")
  })

  it("dismisses and fires callback when dismiss button is clicked", () => {
    const onDismiss = vi.fn()

    const { container } = render(
      <Callout onDismiss={onDismiss}>
        <CalloutIcon />
        <CalloutTitle>Dismissible</CalloutTitle>
        <CalloutContent>Close me.</CalloutContent>
        <CalloutDismiss />
      </Callout>,
    )

    const dismissButton = container.querySelector('button[aria-label="Dismiss"]')
    expect(dismissButton).not.toBeNull()
    if (!dismissButton) return

    fireEvent.click(dismissButton)

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="status"]')).toBeNull()
  })
})
