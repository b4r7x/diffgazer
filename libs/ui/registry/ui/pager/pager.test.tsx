import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect } from "vitest"
import { Pager } from "./index.js"
import type { PagerLinkRenderProps } from "./pager-link.js"

describe("Pager", () => {
  it("links are keyboard accessible", async () => {
    render(
      <Pager>
        <Pager.Link direction="previous" href="/prev">Previous</Pager.Link>
        <Pager.Link direction="next" href="/next">Next</Pager.Link>
      </Pager>
    )
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole("link", { name: "Go to previous page" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("link", { name: "Go to next page" })).toHaveFocus()
  })

  it("passes props to render function children", () => {
    const renderFn = (props: PagerLinkRenderProps) => (
      <a href={props.href} aria-label={props["aria-label"]}>Custom</a>
    )
    render(
      <Pager>
        <Pager.Link direction="next" href="/next">{renderFn}</Pager.Link>
      </Pager>
    )
    expect(screen.getByRole("link", { name: "Go to next page" })).toHaveAttribute("href", "/next")
  })

  it("has no a11y violations", async () => {
    const { container } = render(
      <Pager>
        <Pager.Link direction="previous" href="/prev">Previous</Pager.Link>
        <Pager.Link direction="next" href="/next">Next</Pager.Link>
      </Pager>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
