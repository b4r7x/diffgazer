import { render, screen, waitFor, within } from "@testing-library/react";
import type { TableOfContents } from "fumadocs-core/toc";
import { describe, expect, it } from "vitest";
import { TableOfContentsPanel } from "./toc";

function renderWithHeadings(
  headings: Array<{ tag: "h2" | "h3"; id?: string; text: string }>,
  toc: TableOfContents = [],
) {
  return render(
    <main id="main-content">
      {headings.map(({ tag: Tag, id, text }) => (
        <Tag key={text} id={id}>
          {text}
        </Tag>
      ))}
      <TableOfContentsPanel toc={toc} />
    </main>,
  );
}

function tocLinks() {
  const nav = screen.queryByRole("navigation", { name: /on this page/i });
  if (!nav) return [];
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.textContent?.trim());
}

describe("TableOfContentsPanel", () => {
  it("builds entries from rendered headings even when the static TOC is empty", async () => {
    renderWithHeadings([
      { tag: "h2", id: "installation", text: "Installation" },
      { tag: "h2", id: "tailwind-setup", text: "Tailwind Setup" },
    ]);

    await waitFor(() => expect(tocLinks()).toEqual(["Installation", "Tailwind Setup"]));
  });

  it("includes runtime headings (Step titles) the compile-time TOC misses", async () => {
    renderWithHeadings(
      [
        { tag: "h2", id: "setup", text: "Setup" },
        {
          tag: "h2",
          id: "configure-a-source-alias",
          text: "Configure a source alias",
        },
        { tag: "h2", id: "result", text: "Result" },
      ],
      [{ title: "Setup", url: "#setup", depth: 2 }],
    );

    await waitFor(() =>
      expect(tocLinks()).toEqual(["Setup", "Configure a source alias", "Result"]),
    );
  });

  it("ignores headings without an id, including its own panel title", async () => {
    renderWithHeadings([
      { tag: "h2", id: "with-id", text: "With Id" },
      { tag: "h2", text: "No Id Heading" },
    ]);

    await waitFor(() => expect(tocLinks()).toEqual(["With Id"]));
    expect(tocLinks()).not.toContain("No Id Heading");
    expect(tocLinks()).not.toContain("On this page");
  });

  it("links each entry to its heading anchor", async () => {
    renderWithHeadings([{ tag: "h2", id: "examples", text: "Examples" }]);

    const link = await screen.findByRole("link", { name: "Examples" });
    expect(link).toHaveAttribute("href", "#examples");
  });

  it("refreshes the TOC when a heading is appended after mount", async () => {
    renderWithHeadings([{ tag: "h2", id: "intro", text: "Intro" }]);

    await waitFor(() => expect(tocLinks()).toEqual(["Intro"]));

    const container = document.getElementById("main-content");
    if (!container) throw new Error("missing #main-content container");
    const heading = document.createElement("h2");
    heading.id = "appended";
    heading.textContent = "Appended";
    container.appendChild(heading);

    await waitFor(() => expect(tocLinks()).toEqual(["Intro", "Appended"]));

    const link = screen.getByRole("link", { name: "Appended" });
    expect(link).toHaveAttribute("href", "#appended");
  });

  it("refreshes the TOC when a heading is removed after mount", async () => {
    renderWithHeadings([
      { tag: "h2", id: "kept", text: "Kept" },
      { tag: "h2", id: "temporary", text: "Temporary" },
    ]);

    await waitFor(() => expect(tocLinks()).toEqual(["Kept", "Temporary"]));

    const removed = document.getElementById("temporary");
    if (!removed) throw new Error("missing #temporary heading");
    removed.remove();

    await waitFor(() => expect(tocLinks()).toEqual(["Kept"]));
    expect(tocLinks()).not.toContain("Temporary");
  });

  it("includes h3 headings nested deeper than their h2 siblings", async () => {
    renderWithHeadings([
      { tag: "h2", id: "overview", text: "Overview" },
      { tag: "h3", id: "details", text: "Details" },
    ]);

    await waitFor(() => expect(tocLinks()).toEqual(["Overview", "Details"]));

    const overview = screen.getByRole("link", { name: "Overview" });
    const details = screen.getByRole("link", { name: "Details" });

    // Depth is surfaced to the reader as left indentation: an h3 entry sits
    // deeper than its h2 sibling.
    const overviewIndent = Number.parseInt(overview.style.paddingLeft, 10);
    const detailsIndent = Number.parseInt(details.style.paddingLeft, 10);
    expect(detailsIndent).toBeGreaterThan(overviewIndent);
  });

  it("produces a single TOC link when two headings share one id", async () => {
    renderWithHeadings([
      { tag: "h2", id: "duplicate", text: "First" },
      { tag: "h2", id: "duplicate", text: "Second" },
    ]);

    await waitFor(() =>
      expect(
        within(screen.getByRole("navigation", { name: /on this page/i })).getAllByRole("link"),
      ).toHaveLength(1),
    );

    const links = within(screen.getByRole("navigation", { name: /on this page/i })).getAllByRole(
      "link",
    );
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "#duplicate");
  });
});
