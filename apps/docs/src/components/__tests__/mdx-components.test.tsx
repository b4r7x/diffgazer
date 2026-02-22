// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { HTMLAttributes, ReactElement } from "react"
import { useMDXComponents } from "@/mdx-components"

type HeadingRenderer = (
  props: HTMLAttributes<HTMLHeadingElement>,
) => ReactElement
type PreRenderer = (
  props: HTMLAttributes<HTMLPreElement>,
) => ReactElement
type CodeRenderer = (
  props: HTMLAttributes<HTMLElement>,
) => ReactElement

describe("useMDXComponents", () => {
  it("preserves id props on rendered h2 headings", () => {
    const components = useMDXComponents()
    const H2 = components.h2 as HeadingRenderer

    render(<H2 id="toc-anchor">Table of Contents Anchor</H2>)

    const heading = screen.getByText("Table of Contents Anchor")

    expect(heading.tagName).toBe("H2")
    expect(heading.getAttribute("id")).toBe("toc-anchor")
    expect(heading.className).toContain("scroll-mt-24")
  })

  it("preserves id props on rendered h3 headings", () => {
    const components = useMDXComponents()
    const H3 = components.h3 as HeadingRenderer

    render(<H3 id="nested-anchor">Nested Anchor</H3>)

    const heading = screen.getByText("Nested Anchor")

    expect(heading.tagName).toBe("H3")
    expect(heading.getAttribute("id")).toBe("nested-anchor")
    expect(heading.className).toContain("scroll-mt-24")
  })

  it("renders component section headings when present in MDX", () => {
    const components = useMDXComponents()
    const H2 = components.h2 as HeadingRenderer

    render(<H2 id="component-installation">Installation</H2>)

    const heading = screen.getByText("Installation")
    expect(heading.tagName).toBe("H2")
    expect(heading.getAttribute("id")).toBe("component-installation")
  })

  it("does not apply inline code chip styles to fenced code blocks", () => {
    const components = useMDXComponents()
    const Pre = components.pre as PreRenderer
    const Code = components.code as CodeRenderer

    render(
      <Pre>
        <Code>useKey("Escape")</Code>
      </Pre>,
    )

    const codeElement = screen.getByText('useKey("Escape")')
    expect(codeElement.tagName).toBe("CODE")
    expect(codeElement.className).not.toContain("bg-secondary")
  })

  it("keeps inline code chip styles outside pre blocks", () => {
    const components = useMDXComponents()
    const Code = components.code as CodeRenderer

    render(<Code>mod+s</Code>)

    const codeElement = screen.getByText("mod+s")
    expect(codeElement.className).toContain("bg-secondary")
  })
})
