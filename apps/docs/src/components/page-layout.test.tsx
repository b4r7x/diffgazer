// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocsPageHeader } from "./page-layout";

describe("DocsPageHeader", () => {
  it("renders the lib/slug scope line above the title", () => {
    render(<DocsPageHeader title="Button" lib="ui" slug="button" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Button" });
    const scope = screen.getByText("ui/button");

    // The address precedes the destination, so the reader meets the path first
    // and the title is the last line before the tags.
    expect(scope.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps tag chips alongside the meta line", () => {
    render(<DocsPageHeader title="Button" lib="ui" slug="button" tags={["stable", "form"]} />);

    expect(screen.getByText("ui/button")).toBeInTheDocument();
    expect(screen.getByText("stable")).toBeInTheDocument();
    expect(screen.getByText("form")).toBeInTheDocument();
  });

  it("omits the meta line when the slug is missing", () => {
    render(<DocsPageHeader title="Overview" lib="ui" />);

    expect(screen.queryByText(/^ui\//)).not.toBeInTheDocument();
  });

  it("typesets code spans in the description instead of shipping raw backticks", () => {
    render(
      <DocsPageHeader
        title="Theme"
        description="The `@diffgazer/ui` two-layer system, built on `--base-*` tokens."
      />,
    );

    expect(screen.getByText(/two-layer system/)).not.toHaveTextContent("`");
    expect(screen.getByText("@diffgazer/ui").tagName).toBe("CODE");
    expect(screen.getByText("--base-*").tagName).toBe("CODE");
  });

  it("renders an unpaired backtick verbatim rather than dropping characters", () => {
    render(<DocsPageHeader title="Theme" description="A stray ` backtick stays put." />);

    expect(screen.getByText("A stray ` backtick stays put.")).toBeInTheDocument();
  });
});
