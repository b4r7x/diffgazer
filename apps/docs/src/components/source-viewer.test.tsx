// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SourceViewer } from "./source-viewer"

const files = [
  {
    path: "registry/ui/button/button.tsx",
    raw: "export function Button() {}",
    highlighted: [{ number: 1, content: [{ text: "export function Button() {}" }] }],
  },
]

const multipleFiles = [
  files[0],
  {
    path: "registry/ui/button/button.css",
    raw: ".button {}",
    highlighted: [{ number: 1, content: [{ text: ".button {}" }] }],
  },
]

describe("SourceViewer", () => {
  it("does not synthesize a public installer command when no installer is configured", () => {
    render(<SourceViewer files={files} />)

    expect(screen.queryByText(/Install via CLI/i)).toBeNull()
    expect(screen.queryByText(/npx @diffgazer\/add/i)).toBeNull()
    expect(screen.getByRole("button", { name: /View component source/i })).toBeInTheDocument()
  })

  it("shows the configured install command", () => {
    render(<SourceViewer files={files} installCommand="pnpm exec dgadd add ui/button" />)

    expect(screen.getByText("pnpm exec dgadd add ui/button")).toBeInTheDocument()
  })

  it("announces the file count when multiple files are present", () => {
    render(<SourceViewer files={multipleFiles} />)

    expect(
      screen.getByRole("button", { name: /View component source \(2 files\)/i }),
    ).toBeInTheDocument()
  })

  it("renders consumer-provided integration guidance alongside the install command", () => {
    render(
      <SourceViewer
        files={files}
        installCommand="pnpm exec dgadd add ui/button"
        integrationNote={<span>Use --integration keys for the full experience.</span>}
      />,
    )

    expect(
      screen.getByText(/Use --integration keys for the full experience\./i),
    ).toBeInTheDocument()
  })

  it("shows the merged-source copy button only when merged source is provided", () => {
    const { rerender } = render(<SourceViewer files={files} />)

    expect(screen.queryByText("[Copy Full Source]")).toBeNull()

    rerender(<SourceViewer files={files} mergedSource="export function Button() {}" />)

    expect(screen.getByText("[Copy Full Source]")).toBeInTheDocument()
  })

  it("renders nothing when there are no files", () => {
    const { container } = render(<SourceViewer files={[]} />)

    expect(container.firstChild).toBeNull()
  })
})
