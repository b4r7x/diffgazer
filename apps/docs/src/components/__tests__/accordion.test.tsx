// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

describe("Accordion", () => {
  it("supports single mode with one-open-at-a-time behavior", () => {
    render(
      <Accordion defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Item One</AccordionTrigger>
          <AccordionContent>Content One</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Item Two</AccordionTrigger>
          <AccordionContent>Content Two</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )

    expect(screen.getByText("Content One")).not.toBeNull()
    expect(screen.queryByText("Content Two")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /item two/i }))
    expect(screen.queryByText("Content One")).toBeNull()
    expect(screen.getByText("Content Two")).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /item two/i }))
    expect(screen.queryByText("Content Two")).toBeNull()
  })

  it("supports multiple mode with many sections open at once", () => {
    render(
      <Accordion type="multiple" defaultValue={["item-1"]}>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section A</AccordionTrigger>
          <AccordionContent>Panel A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Section B</AccordionTrigger>
          <AccordionContent>Panel B</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )

    expect(screen.getByText("Panel A")).not.toBeNull()
    expect(screen.queryByText("Panel B")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /section b/i }))
    expect(screen.getByText("Panel A")).not.toBeNull()
    expect(screen.getByText("Panel B")).not.toBeNull()
  })
})
