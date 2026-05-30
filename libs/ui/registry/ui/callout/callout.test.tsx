import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils"
import { describe, it, expect } from "vitest"
import { Callout } from "./index"

function getGrid(container: HTMLElement): HTMLElement {
  const grid = container.querySelector("[data-frame] > [data-has-icon]") as HTMLElement
  expect(grid).not.toBeNull()
  return grid
}

describe("Callout structure", () => {
  it("renders the inline frame by default", () => {
    const { container } = render(
      <Callout>
        <Callout.Content>Hello</Callout.Content>
      </Callout>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute("data-frame", "inline")
  })

  it("rail frame is selected via the data-frame attribute", () => {
    const { container } = render(
      <Callout frame="rail">
        <Callout.Content>Rail</Callout.Content>
      </Callout>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute("data-frame", "rail")
    // The actual border collapse + inline-start rail is owned by
    // shared/callout.css, keyed off [data-frame="rail"]. We assert the
    // public contract (the attribute), not the CSS file's class names.
  })

  it("bar frame renders a tone marker bar matching Dialog marker='bar'", () => {
    const { container } = render(
      <Callout frame="bar" tone="warning">
        <Callout.Title>Bar</Callout.Title>
        <Callout.Content>Body</Callout.Content>
      </Callout>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute("data-frame", "bar")
    const bar = root.querySelector('[aria-hidden="true"].w-1') as HTMLElement
    expect(bar).not.toBeNull()
    expect(bar.style.gridArea).toBe("bar")
  })

  it("collapses the icon column when no Callout.Icon child is present", () => {
    const { container } = render(
      <Callout>
        <Callout.Title>Title only</Callout.Title>
      </Callout>,
    )
    const grid = getGrid(container)
    expect(grid).toHaveAttribute("data-has-icon", "false")
  })

  it("reserves the icon column when Callout.Icon child is present", () => {
    const { container } = render(
      <Callout>
        <Callout.Icon />
        <Callout.Title>Title</Callout.Title>
      </Callout>,
    )
    const grid = getGrid(container)
    expect(grid).toHaveAttribute("data-has-icon", "true")
  })

  it("places title and dismiss on row 1 and body on row 2", () => {
    render(
      <Callout>
        <Callout.Icon />
        <Callout.Title>Heading</Callout.Title>
        <Callout.Content>Body</Callout.Content>
        <Callout.Dismiss />
      </Callout>,
    )
    expect(screen.getByText("Heading").style.gridArea).toBe("title")
    expect(screen.getByText("Body").style.gridArea).toBe("body")
    expect(screen.getByRole("button", { name: "Dismiss" }).style.gridArea).toBe("dismiss")
  })
})

describe("Callout live-region semantics", () => {
  it("renders no role when live is not set", () => {
    render(
      <Callout tone="error">
        <Callout.Content>Silent error</Callout.Content>
      </Callout>,
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("applies role=alert for tone='error' when live", () => {
    render(
      <Callout tone="error" live>
        <Callout.Content>Loud error</Callout.Content>
      </Callout>,
    )
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("applies role=status for tone='info' when live", () => {
    render(
      <Callout tone="info" live>
        <Callout.Content>FYI</Callout.Content>
      </Callout>,
    )
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it.each(["warning", "success"] as const)(
    "applies role=status for tone='%s' when live",
    (tone) => {
      render(
        <Callout tone={tone} live>
          <Callout.Content>announce</Callout.Content>
        </Callout>,
      )
      expect(screen.getByRole("status")).toBeInTheDocument()
    },
  )
})

describe("Callout dismiss", () => {
  it("dismiss button hides the callout", async () => {
    const user = userEvent.setup()
    render(
      <Callout>
        <Callout.Title>Alert</Callout.Title>
        <Callout.Dismiss />
      </Callout>,
    )
    expect(screen.getByText("Alert")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText("Alert")).not.toBeInTheDocument()
  })

  it("dismiss button has aria-label='Dismiss' and lands in the dismiss grid cell", () => {
    render(
      <Callout>
        <Callout.Title>Title</Callout.Title>
        <Callout.Dismiss />
      </Callout>,
    )
    const dismiss = screen.getByRole("button", { name: "Dismiss" })
    expect(dismiss).toHaveAttribute("aria-label", "Dismiss")
    expect(dismiss.style.gridArea).toBe("dismiss")
    // The 24×24 footprint with 4px padding is documented in the anatomy
    // notes and visually owned by Tailwind utilities; size assertions belong
    // in visual regression, not unit tests.
  })

  it("dismiss is focusable and activatable via keyboard", async () => {
    const user = userEvent.setup()
    render(
      <Callout>
        <Callout.Title>Alert</Callout.Title>
        <Callout.Dismiss />
      </Callout>,
    )

    await user.tab()
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(screen.queryByText("Alert")).not.toBeInTheDocument()
  })
})

describe("Callout controlled state", () => {
  it("respects controlled open=false", () => {
    render(
      <Callout open={false}>
        <Callout.Content>hidden</Callout.Content>
      </Callout>,
    )
    expect(screen.queryByText("hidden")).not.toBeInTheDocument()
  })

  it("fires onOpenChange when dismiss is clicked", async () => {
    const user = userEvent.setup()
    let nextOpen: boolean | null = null
    render(
      <Callout open onOpenChange={(o) => { nextOpen = o }}>
        <Callout.Title>Controlled</Callout.Title>
        <Callout.Dismiss />
      </Callout>,
    )
    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(nextOpen).toBe(false)
  })
})

describe("Callout accessibility", () => {
  it("icon is aria-hidden and visually-hidden tone prefix is rendered", () => {
    const { container } = render(
      <Callout tone="warning">
        <Callout.Icon />
        <Callout.Title>Heads up</Callout.Title>
      </Callout>,
    )
    const icon = container.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(icon).not.toBeNull()
    expect(screen.getByText(/Warning:/)).toHaveClass("sr-only")
  })

  it("has no a11y violations across tones and frames", async () => {
    for (const tone of ["info", "warning", "error", "success"] as const) {
      for (const frame of ["inline", "rail", "bar"] as const) {
        const { container, unmount } = render(
          <Callout tone={tone} frame={frame}>
            <Callout.Icon />
            <Callout.Title>{tone} {frame}</Callout.Title>
            <Callout.Content>Body for {tone}</Callout.Content>
            <Callout.Dismiss />
          </Callout>,
        )
        expect(await axe(container)).toHaveNoViolations()
        unmount()
      }
    }
  })
})
