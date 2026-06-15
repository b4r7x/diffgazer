// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CopyButton } from "../copy-button";
import { SourceViewer } from "./source-viewer";

const files = [
  {
    path: "registry/ui/button/button.tsx",
    raw: "export function Button() {}",
    highlighted: [{ number: 1, content: [{ text: "export function Button() {}" }] }],
  },
];

const multipleFiles = [
  ...files,
  {
    path: "registry/ui/button/button.css",
    raw: ".button {}",
    highlighted: [{ number: 1, content: [{ text: ".button {}" }] }],
  },
];

describe("SourceViewer", () => {
  it("does not synthesize a public installer command when no installer is configured", () => {
    render(<SourceViewer files={files} />);

    expect(screen.queryByText(/Install via CLI/i)).toBeNull();
    expect(screen.queryByText(/npx @diffgazer\/add/i)).toBeNull();
    expect(screen.getByRole("button", { name: /View component source/i })).toBeInTheDocument();
  });

  it("shows the configured install command", () => {
    render(<SourceViewer files={files} installCommand="pnpm exec dgadd add ui/button" />);

    expect(screen.getByText("pnpm exec dgadd add ui/button")).toBeInTheDocument();
  });

  it("announces the file count when multiple files are present", () => {
    render(<SourceViewer files={multipleFiles} />);

    expect(
      screen.getByRole("button", {
        name: /View component source \(2 files\)/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders consumer-provided integration guidance alongside the install command", () => {
    render(
      <SourceViewer
        files={files}
        installCommand="pnpm exec dgadd add ui/button"
        integrationNote={<span>Use --integration keys for the full experience.</span>}
      />,
    );

    expect(
      screen.getByText(/Use --integration keys for the full experience\./i),
    ).toBeInTheDocument();
  });

  it("renders a consumer-provided copy button in the Source heading", () => {
    const { rerender } = render(<SourceViewer files={files} />);

    expect(screen.queryByText("[Copy Full Source]")).toBeNull();

    rerender(
      <SourceViewer
        files={files}
        copyButton={<CopyButton text="export function Button() {}" label="Copy Full Source" />}
      />,
    );

    expect(screen.getByText("[Copy Full Source]")).toBeInTheDocument();
  });

  it("renders nothing when there are no files", () => {
    const { container } = render(<SourceViewer files={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("exposes the Source heading with an id for the page ToC", () => {
    render(<SourceViewer files={files} />);

    expect(screen.getByRole("heading", { level: 2, name: "Source" })).toHaveAttribute(
      "id",
      "source",
    );
  });

  it("exposes the source accordion trigger with heading semantics", () => {
    render(<SourceViewer files={files} />);

    expect(screen.getByRole("heading", { name: /View component source/i })).toBeInTheDocument();
  });
});
