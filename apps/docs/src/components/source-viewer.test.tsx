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
})
