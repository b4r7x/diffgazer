import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { App } from "./app";
import { DOCS_URL, GITHUB_URL, INSTALL_COMMAND } from "./content";

// jsdom cannot compute layout, so color-contrast is unreliable here and is
// disabled — mirrors the @diffgazer/ui axe helper.
async function runAxe(container: Element) {
  return axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
}

describe("Landing App", () => {
  it("renders the product name as the page heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: /diffgazer/i })).toBeInTheDocument();
  });

  it("exposes hero CTAs linked to install, docs, and GitHub", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: /^install$/i })).toHaveAttribute("href", "#install");

    // Docs and GitHub appear in the hero and the footer; every instance must
    // resolve to the canonical target.
    const docsLinks = screen.getAllByRole("link", { name: /documentation/i });
    expect(docsLinks.length).toBeGreaterThan(0);
    for (const link of docsLinks) {
      expect(link).toHaveAttribute("href", DOCS_URL);
    }

    const githubLinks = screen.getAllByRole("link", { name: /github/i });
    expect(githubLinks.length).toBeGreaterThan(0);
    for (const link of githubLinks) {
      expect(link).toHaveAttribute("href", GITHUB_URL);
    }
  });

  it("renders the sample diff with added and removed rows", () => {
    render(<App />);
    // The DiffView figure is named by the diffed file path (role + text).
    const diff = screen.getByRole("figure", { name: /score\.ts/i });

    // Row state is exposed accessibly via screen-reader prefixes, not classes.
    expect(within(diff).getAllByText(/^Added:/).length).toBeGreaterThan(0);
    expect(within(diff).getAllByText(/^Removed:/).length).toBeGreaterThan(0);

    // The diff body carries the changed source so it is not an empty shell.
    expect(within(diff).getAllByText(/calculateScore/).length).toBeGreaterThan(0);
  });

  it("offers a j/k navigation hint in the showcase status bar", () => {
    render(<App />);
    expect(screen.getByText("j")).toBeInTheDocument();
    expect(screen.getByText("k")).toBeInTheDocument();
  });

  it("labels the install command and copies it on click", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByLabelText("Install command")).toHaveTextContent(INSTALL_COMMAND);

    await user.click(screen.getByRole("button", { name: /copy install command/i }));

    expect(await navigator.clipboard.readText()).toBe(INSTALL_COMMAND);
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("keeps a skip-to-content link targeting the main landmark", () => {
    render(<App />);
    const skipLink = screen.getByRole("link", { name: /skip to content/i });
    expect(skipLink).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("moves keyboard focus to the skip link first", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.tab();
    expect(screen.getByRole("link", { name: /skip to content/i })).toHaveFocus();
  });

  it("exposes banner, main, and contentinfo landmarks", () => {
    render(<App />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<App />);
    expect(await runAxe(container)).toHaveNoViolations();
  });
});
