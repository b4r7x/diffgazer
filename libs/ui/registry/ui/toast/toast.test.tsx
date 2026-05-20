import { render, screen, act, waitFor, fireEvent } from "@testing-library/react"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { toast, Toaster } from "./index.js"
import { dismiss, remove, useToastStore } from "./toast-store.js"
import { Dialog } from "../dialog/index.js"

function StoreReader({ onRead }: { onRead: (ids: string[]) => void }) {
  const { toasts } = useToastStore()
  onRead(toasts.map((t) => t.id))
  return null
}

function cleanupStore() {
  let ids: string[] = []
  const { unmount } = render(<StoreReader onRead={(v) => { ids = v }} />)
  unmount()
  for (const id of ids) {
    dismiss(id)
    remove(id)
  }
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true })
  })

  afterEach(() => {
    cleanupStore()
    vi.useRealTimers()
  })

  it("creates a toast via toast() API and renders in Toaster", () => {
    render(<Toaster />)
    act(() => { toast("Hello world") })
    expect(screen.getByText("Hello world")).toBeInTheDocument()
  })

  it("creates fallback ids when randomUUID is unavailable", () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto")
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined })

    try {
      render(<Toaster />)
      let id!: string
      act(() => { id = toast("Fallback id") })
      expect(id).toMatch(/^toast-/)
      expect(screen.getByText("Fallback id")).toBeInTheDocument()
    } finally {
      if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor)
    }
  })

  it("renders toast with a message body", () => {
    render(<Toaster />)
    act(() => { toast("Title", { message: "Body text" }) })
    expect(screen.getByText("Title")).toBeInTheDocument()
    expect(screen.getByText("Body text")).toBeInTheDocument()
  })

  it("auto-dismisses after duration", () => {
    render(<Toaster />)
    act(() => { toast("Quick", { duration: 1000 }) })
    expect(screen.getByText("Quick")).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("Quick")).not.toBeInTheDocument()
  })

  it("does not auto-dismiss error tone without explicit duration", () => {
    render(<Toaster />)
    act(() => { toast.error("Error occurred") })

    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText("Error occurred")).toBeInTheDocument()
  })

  it("auto-dismisses error tone with explicit duration", () => {
    render(<Toaster />)
    act(() => { toast.error("Error occurred", { duration: 2000 }) })

    act(() => { vi.advanceTimersByTime(2000) })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("Error occurred")).not.toBeInTheDocument()
  })

  it("creates toast via tone helpers and tags data-tone", () => {
    render(<Toaster />)
    act(() => {
      toast.success("Saved!")
      toast.error("Failed!")
      toast.warning("Caution!")
      toast.info("FYI")
    })
    expect(screen.getByText("Saved!")).toBeInTheDocument()
    expect(screen.getByText("Failed!")).toBeInTheDocument()
    expect(screen.getByText("Caution!")).toBeInTheDocument()
    expect(screen.getByText("FYI")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Failed!")

    // querySelector: data-tone is the public attribute contract — the role
    // queries above prove ARIA semantics; this is a structural check on the
    // tone tagging used by CSS selectors and downstream tooling.
    const success = document.querySelector('[data-slot="toast"][data-tone="success"]')
    expect(success).not.toBeNull()
    expect(success).toHaveTextContent("Saved!")
  })

  it("renders role=alert for tone=error via the imperative options form", () => {
    render(<Toaster />)
    act(() => { toast("Boom", { tone: "error" }) })
    expect(screen.getByRole("alert")).toHaveTextContent("Boom")
  })

  it("renders the loading toast spinner via the lazy chunk", async () => {
    vi.useRealTimers()
    render(<Toaster />)
    act(() => { toast.loading("Working") })

    const toastEl = screen.getByText("Working").closest('[role="status"]')
    expect(toastEl).not.toBeNull()
    await waitFor(() => {
      expect(toastEl?.querySelector('[role="status"][aria-label="Loading"]')).not.toBeNull()
    })
    vi.useFakeTimers()
  })

  it("tracks a resolved promise via toast.promise()", async () => {
    render(<Toaster />)
    let resolve!: (value: string) => void
    const promise = new Promise<string>((r) => { resolve = r })

    act(() => {
      toast.promise(promise, {
        loading: "Loading...",
        success: (data) => `Done: ${data}`,
        error: "Failed",
      })
    })
    expect(screen.getByText("Loading...")).toBeInTheDocument()

    await act(async () => { resolve("ok") })
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    expect(screen.getByText("Done: ok")).toBeInTheDocument()
  })

  it("tracks a rejected promise via toast.promise()", async () => {
    render(<Toaster />)
    let reject!: (reason: unknown) => void
    const promise = new Promise<string>((_, r) => { reject = r })

    act(() => {
      toast.promise(promise, {
        loading: "Loading...",
        success: "Done",
        error: (err) => `Error: ${(err as Error).message}`,
      }).catch(() => {})
    })

    await act(async () => { reject(new Error("boom")) })
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    expect(screen.getByText("Error: boom")).toBeInTheDocument()
  })

  it("evicts oldest toasts when exceeding max 5", () => {
    render(<Toaster />)
    act(() => {
      toast("Toast 1", { id: "ev1" })
      toast("Toast 2", { id: "ev2" })
      toast("Toast 3", { id: "ev3" })
      toast("Toast 4", { id: "ev4" })
      toast("Toast 5", { id: "ev5" })
      toast("Toast 6", { id: "ev6" })
    })

    expect(screen.queryByText("Toast 1")).not.toBeInTheDocument()
    expect(screen.getByText("Toast 2")).toBeInTheDocument()
    expect(screen.getByText("Toast 6")).toBeInTheDocument()
  })

  it("dismisses a toast via toast.dismiss(id)", () => {
    render(<Toaster />)
    let id!: string
    act(() => { id = toast("Dismissable") })
    expect(screen.getByText("Dismissable")).toBeInTheDocument()

    act(() => { toast.dismiss(id) })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("Dismissable")).not.toBeInTheDocument()
  })

  it("dismisses all toasts via toast.dismiss() without id", () => {
    render(<Toaster />)
    act(() => {
      toast("One")
      toast("Two")
    })
    expect(screen.getByText("One")).toBeInTheDocument()
    expect(screen.getByText("Two")).toBeInTheDocument()

    act(() => { toast.dismiss() })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("One")).not.toBeInTheDocument()
    expect(screen.queryByText("Two")).not.toBeInTheDocument()
  })

  it("updates an existing toast when same id is reused", () => {
    render(<Toaster />)
    act(() => { toast("Original", { id: "same" }) })
    expect(screen.getByText("Original")).toBeInTheDocument()

    act(() => { toast("Updated", { id: "same" }) })
    expect(screen.queryByText("Original")).not.toBeInTheDocument()
    expect(screen.getByText("Updated")).toBeInTheDocument()
  })

  it("does not steal focus when a toast appears", () => {
    render(
      <div>
        <input aria-label="Focused input" />
        <Toaster />
      </div>
    )
    const input = screen.getByRole("textbox", { name: "Focused input" })
    input.focus()
    expect(document.activeElement).toBe(input)

    act(() => { toast("New toast") })
    expect(document.activeElement).toBe(input)
  })

  it("passes axe accessibility check", async () => {
    // axe runs async internals that conflict with fake timers
    vi.useRealTimers()
    const { container } = render(<Toaster />)
    act(() => { toast.info("Info toast") })
    expect(await axe(container)).toHaveNoViolations()
    vi.useFakeTimers()
  })

  it("dismisses the last toast on Escape key", () => {
    render(<Toaster />)
    act(() => {
      toast("First", { id: "k1" })
      toast("Second", { id: "k2" })
    })

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    act(() => { vi.advanceTimersByTime(250) })

    expect(screen.queryByText("Second")).not.toBeInTheDocument()
    expect(screen.getByText("First")).toBeInTheDocument()
  })

  it("does not dismiss a toast on Escape while a dialog is open", () => {
    render(
      <>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Blocking dialog</Dialog.Title>
          </Dialog.Content>
        </Dialog>
        <Toaster />
      </>
    )
    act(() => { toast("Background toast", { id: "dialog-toast" }) })

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    act(() => { vi.advanceTimersByTime(250) })

    expect(screen.getByText("Background toast")).toBeInTheDocument()
  })

  it("renders a toast triggered while a modal dialog is open", () => {
    render(
      <>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Blocking dialog</Dialog.Title>
          </Dialog.Content>
        </Dialog>
        <Toaster />
      </>
    )

    act(() => { toast.error("Failed to save", { id: "over-dialog" }) })

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Failed to save")
    expect(screen.getByRole("region", { name: "Notifications" })).toContainElement(alert)
  })

  it("activates Popover API on the container when the browser supports it", () => {
    // Boundary mock: jsdom does not implement HTMLElement.prototype.popover /
    // showPopover() / hidePopover() / :popover-open. Stub them per test so
    // we can verify the Toaster's feature-detection branch on a supporting
    // browser. The non-supporting branch stays covered by every other test.
    const Proto = HTMLElement.prototype
    const popoverDesc = Object.getOwnPropertyDescriptor(Proto, "popover")
    const showDesc = Object.getOwnPropertyDescriptor(Proto, "showPopover")
    const hideDesc = Object.getOwnPropertyDescriptor(Proto, "hidePopover")
    const matchesDesc = Object.getOwnPropertyDescriptor(Proto, "matches")
    const originalMatches = Proto.matches
    let openCount = 0
    Object.defineProperty(Proto, "popover", {
      configurable: true,
      get(this: HTMLElement) { return this.getAttribute("popover") },
      set(this: HTMLElement, v: string | null) {
        if (v == null) this.removeAttribute("popover")
        else this.setAttribute("popover", v)
      },
    })
    Object.defineProperty(Proto, "showPopover", {
      configurable: true, writable: true,
      value(this: HTMLElement) { openCount++; this.setAttribute("data-popover-open", "") },
    })
    Object.defineProperty(Proto, "hidePopover", {
      configurable: true, writable: true,
      value(this: HTMLElement) { openCount--; this.removeAttribute("data-popover-open") },
    })
    Object.defineProperty(Proto, "matches", {
      configurable: true, writable: true,
      value(this: HTMLElement, selector: string) {
        if (selector === ":popover-open") return this.hasAttribute("data-popover-open")
        return originalMatches.call(this, selector)
      },
    })

    try {
      const { unmount, container } = render(<Toaster />)
      expect(openCount).toBe(0)

      act(() => { toast("Top-layer toast", { id: "tl-1" }) })
      const region = container.ownerDocument.querySelector("[role='region'][aria-label='Notifications']")
      expect(region).not.toBeNull()
      expect(region).toHaveAttribute("popover", "manual")
      expect(region).toHaveAttribute("data-popover-open")
      expect(openCount).toBe(1)

      act(() => { toast.dismiss() })
      act(() => { vi.advanceTimersByTime(250) })
      expect(region).not.toHaveAttribute("data-popover-open")
      expect(openCount).toBe(0)

      act(() => { toast("Re-issued", { id: "tl-2" }) })
      expect(region).toHaveAttribute("data-popover-open")
      expect(openCount).toBe(1)

      unmount()
      expect(openCount).toBe(0)
    } finally {
      if (popoverDesc) Object.defineProperty(Proto, "popover", popoverDesc)
      else Reflect.deleteProperty(Proto, "popover")
      if (showDesc) Object.defineProperty(Proto, "showPopover", showDesc)
      else Reflect.deleteProperty(Proto, "showPopover")
      if (hideDesc) Object.defineProperty(Proto, "hidePopover", hideDesc)
      else Reflect.deleteProperty(Proto, "hidePopover")
      if (matchesDesc) Object.defineProperty(Proto, "matches", matchesDesc)
    }
  })

  it("pauses auto-dismiss on pointer hover and resumes on leave (WCAG 2.2.1)", () => {
    render(<Toaster />)
    act(() => { toast("Hovered toast", { duration: 3000 }) })

    act(() => { vi.advanceTimersByTime(1000) })

    const region = screen.getByRole("region", { name: "Notifications" })
    act(() => { fireEvent.mouseEnter(region) })

    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText("Hovered toast")).toBeInTheDocument()

    act(() => { fireEvent.mouseLeave(region) })
    act(() => { vi.advanceTimersByTime(2000) })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("Hovered toast")).not.toBeInTheDocument()
  })

  it("pauses auto-dismiss when focus enters the region and resumes on blur (WCAG 2.2.1)", () => {
    render(<Toaster />)
    act(() => {
      toast("Focusable toast", {
        duration: 3000,
        action: <button type="button">Undo</button>,
      })
    })

    act(() => { vi.advanceTimersByTime(1000) })

    const actionButton = screen.getByRole("button", { name: "Undo" })
    act(() => { actionButton.focus() })

    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText("Focusable toast")).toBeInTheDocument()

    act(() => { actionButton.blur() })
    act(() => { vi.advanceTimersByTime(2000) })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("Focusable toast")).not.toBeInTheDocument()
  })

  it("resumes auto-dismiss after the last toast is removed (no sticky-paused state)", () => {
    render(<Toaster />)
    act(() => { toast("First", { id: "stick-1" }) })

    const region = screen.getByRole("region", { name: "Notifications" })
    act(() => { fireEvent.mouseEnter(region) })

    act(() => { toast.dismiss("stick-1") })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("First")).not.toBeInTheDocument()

    // Cursor leaves the (now empty) region; without the fix, resume() never
    // fires and the next toast inherits a frozen timer.
    act(() => { fireEvent.mouseLeave(region) })

    act(() => { toast("Second", { id: "stick-2", duration: 1000 }) })
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("Second")).not.toBeInTheDocument()
  })

  it("renders a visible focus ring on the close button (WCAG 2.4.13)", () => {
    render(<Toaster />)
    act(() => { toast("Closeable", { message: "Body" }) })
    const close = screen.getByRole("button", { name: /Dismiss: Closeable/ })
    // The focus-visible utilities below are the public a11y contract: a 2px
    // primary-coloured ring offset 2px from the button matches the project's
    // shared focus appearance (Button, Dialog.CloseIcon).
    expect(close.className).toMatch(/focus-visible:ring-2/)
    expect(close.className).toMatch(/focus-visible:ring-offset-2/)
  })

  it("pauses auto-dismiss while document is hidden and resumes on return", () => {
    render(<Toaster />)
    act(() => { toast("Paused toast", { duration: 3000 }) })

    act(() => { vi.advanceTimersByTime(1000) })

    Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText("Paused toast")).toBeInTheDocument()

    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    act(() => { vi.advanceTimersByTime(2000) })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("Paused toast")).not.toBeInTheDocument()
  })

  describe("variant layouts", () => {
    function findToast(text: string) {
      // querySelector: the toast root carries the data-variant attribute used
      // by CSS and downstream tooling; ARIA queries don't expose attribute
      // values. Looking up by visible text first guarantees we read the
      // current toast regardless of layout shape.
      return screen.getByText(text).closest('[data-slot="toast"]')
    }

    it("variant=\"card\" is the default", () => {
      render(<Toaster />)
      act(() => { toast("Card default") })
      const root = findToast("Card default")
      expect(root).toHaveAttribute("data-variant", "card")
    })

    it("variant=\"hud\" omits the close button and action", () => {
      render(<Toaster />)
      act(() => { toast("Copied", { variant: "hud" }) })
      const root = findToast("Copied")
      expect(root).toHaveAttribute("data-variant", "hud")
      expect(root?.querySelector("button")).toBeNull()
      expect(root?.querySelector('[data-slot="toast-action"]')).toBeNull()
    })

    it("variant=\"hud\" auto-dismisses even when an action is supplied (HUD drops the action, so persistence rule does not apply)", () => {
      // HUD ignores `action`, so the toast must follow the default auto-dismiss
      // behavior — not inherit the action-persists rule from card/countdown.
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      try {
        render(<Toaster />)
        act(() => {
          toast("Quick HUD", { variant: "hud", action: <button>Undo</button> })
        })
        expect(screen.getByText("Quick HUD")).toBeInTheDocument()

        act(() => { vi.advanceTimersByTime(5000) })
        act(() => { vi.advanceTimersByTime(250) })
        expect(screen.queryByText("Quick HUD")).not.toBeInTheDocument()
      } finally {
        warn.mockRestore()
      }
    })

    it("variant=\"hud\" warns in development when an action is provided", () => {
      const prevEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      try {
        render(<Toaster />)
        act(() => {
          toast("Saved", {
            variant: "hud",
            action: <button>Undo</button>,
          })
        })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("variant=\"hud\""))
        const root = findToast("Saved")
        expect(root?.querySelector('[data-slot="toast-action"]')).toBeNull()
        expect(root?.textContent).not.toContain("Undo")
      } finally {
        warn.mockRestore()
        process.env.NODE_ENV = prevEnv
      }
    })

    it("variant=\"viewfinder\" renders four corner spans", () => {
      render(<Toaster />)
      act(() => { toast("Saved", { variant: "viewfinder", message: "All done" }) })
      const root = findToast("Saved")
      const corners = root?.querySelector('[data-slot="toast-corners"]')
      expect(corners).not.toBeNull()
      expect(corners?.querySelectorAll("span")).toHaveLength(4)
    })

    it("variant=\"hud\" stays role=status even for error tone (informational by definition)", () => {
      render(<Toaster />)
      act(() => { toast("Failed to copy", { tone: "error", variant: "hud" }) })
      const root = findToast("Failed to copy")
      expect(root).toHaveAttribute("role", "status")
      // role="status" implies aria-live="polite" — we intentionally do not set
      // it explicitly to avoid the WAI-ARIA "both role and aria-live" footgun.
      expect(root).not.toHaveAttribute("aria-live")
    })

    it("variant=\"countdown\" renders an aria-hidden countdown slot", () => {
      render(<Toaster />)
      act(() => {
        toast("Synced", { variant: "countdown", message: "12 files", duration: 5000 })
      })
      const root = findToast("Synced")
      const countdown = root?.querySelector('[data-slot="toast-countdown"]')
      expect(countdown).not.toBeNull()
      expect(countdown).toHaveAttribute("aria-hidden", "true")
    })
  })
})
