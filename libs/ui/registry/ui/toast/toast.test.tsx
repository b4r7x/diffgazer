import { render, screen, act, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

  it("does not auto-dismiss error variant without explicit duration", () => {
    render(<Toaster />)
    act(() => { toast.error("Error occurred") })

    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText("Error occurred")).toBeInTheDocument()
  })

  it("auto-dismisses error variant with explicit duration", () => {
    render(<Toaster />)
    act(() => { toast.error("Error occurred", { duration: 2000 }) })

    act(() => { vi.advanceTimersByTime(2000) })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("Error occurred")).not.toBeInTheDocument()
  })

  it("creates toast via variant helpers", () => {
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
  })

  it("renders the loading toast spinner via the lazy chunk", async () => {
    vi.useRealTimers()
    render(<Toaster />)
    act(() => { toast.loading("Working") })

    const toastEl = screen.getByText("Working").closest('[role="status"]')
    expect(toastEl).not.toBeNull()
    // querySelector: Spinner sits inside an aria-hidden icon span and is
    // excluded from the accessibility tree; this structural assertion
    // confirms the Suspense fallback resolved and the spinner mounted.
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
    // Native <dialog>.showModal() promotes the dialog into the browser top-
    // layer, hiding any z-index-positioned overlay. The Toaster opts into the
    // Popover API when supported so its content joins the top-layer above the
    // dialog; in environments without Popover support (jsdom) the toast stays
    // in the DOM and is announced via role="alert".
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
      // [popover] is hidden by the UA stylesheet until showPopover() runs;
      // querySelector bypasses accessibility-tree filtering so we can read
      // the attribute and confirm the container opted in.
      // querySelector: structural assertion on the popover container which
      // the UA stylesheet hides until top-layer promotion.
      const { unmount, container } = render(<Toaster />)
      // No toasts → popover should not be opened yet.
      expect(openCount).toBe(0)

      // First toast → popover opens once.
      act(() => { toast("Top-layer toast", { id: "tl-1" }) })
      const region = container.ownerDocument.querySelector("[role='region'][aria-label='Notifications']")
      expect(region).not.toBeNull()
      expect(region).toHaveAttribute("popover", "manual")
      expect(region).toHaveAttribute("data-popover-open")
      expect(openCount).toBe(1)

      // Dismiss everything → effect cleanup hides the popover.
      act(() => { toast.dismiss() })
      act(() => { vi.advanceTimersByTime(250) })
      expect(region).not.toHaveAttribute("data-popover-open")
      expect(openCount).toBe(0)

      // A new toast after dismissal re-issues showPopover(); a real browser
      // moves the popover to the back of the top-layer, so a toast raised
      // AFTER a dialog opens still paints above it.
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

  it("pauses auto-dismiss while document is hidden and resumes on return", () => {
    render(<Toaster />)
    act(() => { toast("Paused toast", { duration: 3000 }) })

    // Consume part of the duration before hiding
    act(() => { vi.advanceTimersByTime(1000) })

    Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    // Time passes while hidden — toast should persist
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText("Paused toast")).toBeInTheDocument()

    // Become visible again — remaining ~2000ms should elapse
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    act(() => { vi.advanceTimersByTime(2000) })
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByText("Paused toast")).not.toBeInTheDocument()
  })
})
