// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SourceViewer } from "@/components/source-viewer"

describe("SourceViewer", () => {
  it("expands source files when trigger is clicked", () => {
    render(
      <SourceViewer
        files={[
          {
            path: "registry/ui/example.tsx",
            raw: "export const Example = () => null",
            highlighted: [{ number: 1, content: "export const Example = () => null" }],
          },
        ]}
      />,
    )

    expect(screen.queryByText("registry/ui/example.tsx")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /view component source/i }))

    expect(screen.getByText("registry/ui/example.tsx")).not.toBeNull()
  })
})
