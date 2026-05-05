import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { toast, Toaster } from "./index.js"
import { dismiss, remove, useToastStore } from "./toast-store.js"

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
    const { container } = render(
      <div>
        <input data-testid="focused-input" />
        <Toaster />
      </div>
    )
    const input = screen.getByTestId("focused-input")
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

