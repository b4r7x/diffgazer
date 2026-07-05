// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocsPageHeader } from "./page-layout";

describe("DocsPageHeader", () => {
  it("renders the lib/slug meta line under the title", () => {
    render(<DocsPageHeader title="Button" lib="ui" slug="button" />);

    expect(screen.getByRole("heading", { level: 1, name: "Button" })).toBeInTheDocument();
    expect(screen.getByText("ui/button")).toBeInTheDocument();
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
});
