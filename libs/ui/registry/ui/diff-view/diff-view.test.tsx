import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef, useLayoutEffect } from "react"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect } from "vitest"
import { DiffView, computeDiff } from "./index.js"
import type { ParsedDiff } from "@/lib/diff"

const ONE_HUNK: ParsedDiff = {
  oldPath: "src/app.ts",
  newPath: "src/app.ts",
  hunks: [
    {
      oldStart: 1,
      oldCount: 3,
      newStart: 1,
      newCount: 4,
      heading: "function main",
      changes: [
        { type: "context", content: "import { run } from './run'", oldLine: 1, newLine: 1 },
        { type: "remove", content: "const x = 1", oldLine: 2, newLine: null },
        { type: "add", content: "const x = 2", oldLine: null, newLine: 2 },
        { type: "add", content: "const y = 3", oldLine: null, newLine: 3 },
        { type: "context", content: "run()", oldLine: 3, newLine: 4 },
      ],
    },
  ],
}

const THREE_HUNKS: ParsedDiff = {
  oldPath: "a.ts",
  newPath: "b.ts",
  hunks: [
    {
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
      heading: "hunk one",
      changes: [
        { type: "remove", content: "alpha", oldLine: 1, newLine: null },
        { type: "add", content: "beta", oldLine: null, newLine: 1 },
      ],
    },
    {
      oldStart: 10,
      oldCount: 1,
      newStart: 10,
      newCount: 2,
      heading: "hunk two",
      changes: [
        { type: "context", content: "unchanged", oldLine: 10, newLine: 10 },
        { type: "add", content: "added", oldLine: null, newLine: 11 },
      ],
    },
    {
      oldStart: 20,
      oldCount: 1,
      newStart: 21,
      newCount: 1,
      heading: "hunk three",
      changes: [
        { type: "remove", content: "gamma", oldLine: 20, newLine: null },
        { type: "add", content: "delta", oldLine: null, newLine: 21 },
      ],
    },
  ],
}

const NO_CHANGES: ParsedDiff = {
  oldPath: null,
  newPath: null,
  hunks: [],
}

function getLiveRegion() {
  return document.querySelector("[aria-live='polite']")!
}

function LayoutTextProbe({ onText }: { onText: (text: string) => void }) {
  useLayoutEffect(() => {
    onText(getLiveRegion().textContent ?? "")
  })

  return null
}

describe("DiffView", () => {
  it("renders unified mode by default and split mode when specified", () => {
    const { unmount } = render(<DiffView diff={ONE_HUNK} />)
    expect(screen.getByLabelText("Unified diff")).toBeInTheDocument()
    expect(screen.queryByLabelText("Split diff")).not.toBeInTheDocument()
    unmount()

    render(<DiffView diff={ONE_HUNK} mode="split" />)
    expect(screen.getByLabelText("Split diff")).toBeInTheDocument()
    expect(screen.queryByLabelText("Unified diff")).not.toBeInTheDocument()
  })

  it("forwards refs to the diff region", () => {
    const ref = createRef<HTMLDivElement>()
    render(<DiffView ref={ref} diff={ONE_HUNK} label="Changes" />)

    expect(ref.current).toBe(screen.getByRole("region", { name: "Changes" }))
  })

  it("shows file header with path", () => {
    render(<DiffView diff={ONE_HUNK} />)
    expect(screen.getByText("src/app.ts")).toBeInTheDocument()
  })

  it("shows rename path with arrow when oldPath differs from newPath", () => {
    render(<DiffView diff={THREE_HUNKS} />)
    expect(screen.getByText("a.ts → b.ts")).toBeInTheDocument()
  })

  it("shows 'No changes' when diff has no hunks", () => {
    render(<DiffView diff={NO_CHANGES} />)
    expect(screen.getByRole("status")).toHaveTextContent("No changes")
  })

  it("renders hunk headers with correct format", () => {
    render(<DiffView diff={ONE_HUNK} />)
    expect(screen.getByText("@@ -1,3 +1,4 @@ function main")).toBeInTheDocument()
  })

  it("renders added and removed line content (word-diff may split text)", () => {
    render(<DiffView diff={ONE_HUNK} disableWordDiff />)
    expect(screen.getByText("const x = 2")).toBeInTheDocument()
    expect(screen.getByText("const x = 1")).toBeInTheDocument()
  })

  it("navigates hunks forward with j key", async () => {
    const user = userEvent.setup()
    render(<DiffView diff={THREE_HUNKS} />)

    const container = screen.getByLabelText("Unified diff")
    await user.click(container)

    await user.keyboard("j")
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3: hunk one")
  })

  it("navigates backward with k key", async () => {
    const user = userEvent.setup()
    render(<DiffView diff={THREE_HUNKS} />)

    const container = screen.getByLabelText("Unified diff")
    await user.click(container)

    await user.keyboard("j")
    await user.keyboard("j")
    expect(getLiveRegion()).toHaveTextContent("Hunk 2 of 3: hunk two")

    await user.keyboard("k")
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3: hunk one")
  })

  it("does not wrap past last hunk when pressing j (wrap: false)", async () => {
    const user = userEvent.setup()
    render(<DiffView diff={THREE_HUNKS} />)

    const container = screen.getByLabelText("Unified diff")
    await user.click(container)

    await user.keyboard("j")
    await user.keyboard("j")
    await user.keyboard("j")
    expect(getLiveRegion()).toHaveTextContent("Hunk 3 of 3")

    await user.keyboard("j")
    expect(getLiveRegion()).toHaveTextContent("Hunk 3 of 3")
  })

  it("has no a11y violations in unified mode", async () => {
    const { container } = render(<DiffView diff={ONE_HUNK} label="Test diff" />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations in split mode", async () => {
    const { container } = render(<DiffView diff={ONE_HUNK} mode="split" label="Split test" />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations with no changes", async () => {
    const { container } = render(<DiffView diff={NO_CHANGES} label="Empty diff" />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("does not render div descendants under pre code in unified mode", () => {
    const { container } = render(<DiffView diff={ONE_HUNK} />)

    expect(container.querySelector("pre code div")).toBeNull()
  })

  it("does not render div descendants under pre code in split mode", () => {
    const { container } = render(<DiffView diff={ONE_HUNK} mode="split" />)

    expect(container.querySelector("pre code div")).toBeNull()
  })

  it("Escape clears active hunk selection", async () => {
    const user = userEvent.setup()
    render(<DiffView diff={THREE_HUNKS} />)

    const container = screen.getByLabelText("Unified diff")
    await user.click(container)

    await user.keyboard("j")
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3")

    await user.keyboard("{Escape}")
    expect(getLiveRegion()).toHaveTextContent("")
  })

  it("j/k do nothing when there are no hunks", async () => {
    const user = userEvent.setup()
    render(<DiffView diff={NO_CHANGES} />)

    expect(screen.getByRole("status")).toHaveTextContent("No changes")

    await user.keyboard("j")
    await user.keyboard("k")
    expect(getLiveRegion()).toHaveTextContent("")
  })

  it("does not expose hunk headers as buttons", () => {
    render(<DiffView diff={ONE_HUNK} />)
    expect(screen.queryByRole("button", { name: /Change section/ })).not.toBeInTheDocument()
    expect(screen.getByText("@@ -1,3 +1,4 @@ function main")).toBeInTheDocument()
  })

  it("computes empty file changes without fake blank lines", () => {
    const added = computeDiff("", "alpha\n")
    expect(added.hunks[0].oldCount).toBe(0)
    expect(added.hunks[0].newCount).toBe(1)
    expect(added.hunks[0].changes).toEqual([
      { type: "add", content: "alpha", oldLine: null, newLine: 1 },
    ])

    const removed = computeDiff("alpha\n", "")
    expect(removed.hunks[0].oldCount).toBe(1)
    expect(removed.hunks[0].newCount).toBe(0)
    expect(removed.hunks[0].changes).toEqual([
      { type: "remove", content: "alpha", oldLine: 1, newLine: null },
    ])
  })

  it("resets active hunk announcements when content changes with the same hunk count", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DiffView diff={THREE_HUNKS} />)

    await user.click(screen.getByLabelText("Unified diff"))
    await user.keyboard("j")
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3")

    rerender(<DiffView diff={{
      ...THREE_HUNKS,
      hunks: THREE_HUNKS.hunks.map((hunk, index) => ({
        ...hunk,
        heading: `replacement ${index + 1}`,
      })),
    }} />)
    expect(getLiveRegion()).toHaveTextContent("")
  })

  it("clears stale active hunk during the same render as a diff identity change", async () => {
    const user = userEvent.setup()
    const layoutTexts: string[] = []
    const replacementDiff = {
      ...THREE_HUNKS,
      hunks: THREE_HUNKS.hunks.map((hunk, index) => ({
        ...hunk,
        heading: `replacement ${index + 1}`,
      })),
    }
    const { rerender } = render(
      <>
        <DiffView diff={THREE_HUNKS} />
        <LayoutTextProbe onText={(text) => layoutTexts.push(text)} />
      </>,
    )

    await user.click(screen.getByLabelText("Unified diff"))
    await user.keyboard("j")
    expect(getLiveRegion()).toHaveTextContent("Hunk 1 of 3")

    layoutTexts.length = 0
    rerender(
      <>
        <DiffView diff={replacementDiff} />
        <LayoutTextProbe onText={(text) => layoutTexts.push(text)} />
      </>,
    )

    expect(layoutTexts[layoutTexts.length - 1]).toBe("")
    expect(getLiveRegion()).toHaveTextContent("")
  })

  it("falls back for large computed diffs instead of building huge LCS tables", () => {
    const before = Array.from({ length: 600 }, (_, i) => `old ${i}`).join("\n")
    const after = Array.from({ length: 600 }, (_, i) => `new ${i}`).join("\n")

    const parsed = computeDiff(before, after)

    expect(parsed.hunks).toHaveLength(1)
    expect(parsed.hunks[0].oldCount).toBe(600)
    expect(parsed.hunks[0].newCount).toBe(600)
  })

  it("uses an aggregate word-diff budget and falls back to line-level changes", () => {
    const makeLine = (variant: string, index: number) =>
      Array.from({ length: 18 }, (_, i) => `shared-${i}`)
        .concat(`${variant}-${index}`)
        .join(" ")
    const removes = Array.from({ length: 45 }, (_, i) => ({
      type: "remove" as const,
      content: makeLine("old", i),
      oldLine: i + 1,
      newLine: null,
    }))
    const adds = Array.from({ length: 45 }, (_, i) => ({
      type: "add" as const,
      content: makeLine("new", i),
      oldLine: null,
      newLine: i + 1,
    }))
    render(
      <DiffView
        diff={{
          oldPath: "old.txt",
          newPath: "new.txt",
          hunks: [{
            oldStart: 1,
            oldCount: removes.length,
            newStart: 1,
            newCount: adds.length,
            heading: "",
            changes: [...removes, ...adds],
          }],
        }}
      />,
    )

    expect(screen.getByText(removes[removes.length - 1].content)).toBeInTheDocument()
    expect(screen.getByText(adds[adds.length - 1].content)).toBeInTheDocument()
  })

})
