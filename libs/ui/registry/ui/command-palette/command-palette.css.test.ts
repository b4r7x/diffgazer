import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

describe("CommandPalette CSS contract", () => {
  // jsdom's CSSOM ignores rules nested in @layer and pseudo-element styles, so
  // assert the CSS contract by parsing the source selectors/declarations directly.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../command-palette.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  function ruleBody(selectorFragment: string): string | null {
    const escaped = selectorFragment
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+")
      .replace(/:not\\\(/g, ":not\\(\\s*")
      .replace(/\\\)/g, "\\s*\\)");
    const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    return match?.[1] ?? null;
  }

  it("viewfinder selection draws a 2px left accent bar via ::after", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="viewfinder"] [data-slot="command-palette-item"][aria-selected="true"]::after',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("width: 2px");
    expect(body).toContain("background: var(--command-palette-fg, var(--foreground))");
    expect(body).toContain('content: ""');
  });

  it("viewfinder group headings render uppercase with letter-spacing", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="viewfinder"] [data-slot="command-palette-group-heading"]',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("text-transform: uppercase");
    expect(body).toContain("letter-spacing: 0.06em");
    expect(body).toContain("font-size: 11px");
  });

  it("terminal frame heading adopts the kebab padding and lighter weight", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="terminal"] [data-slot="command-palette-group-heading"]',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("font-weight: 400");
    expect(body).toContain("padding: 6px var(--command-palette-input-px) 2px");
  });

  it("terminal-frame selected row re-tints the tone bar to --command-palette-bg", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="terminal"] [data-slot="command-palette-item"][aria-selected="true"][data-tone]:not([data-tone="neutral"])::before',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("background: var(--command-palette-bg, var(--background))");
  });

  it("disabled items hide the tone bar", () => {
    const body = ruleBody('[data-slot="command-palette-item"][aria-disabled="true"]::before');
    expect(body).not.toBeNull();
    expect(body).toContain("display: none");
  });

  it("card frame defines a rounded shell with a gradient surface", () => {
    const body = ruleBody('[data-slot="command-palette-content"][data-frame="card"]');
    expect(body).not.toBeNull();
    expect(body).toContain("border-radius: 8px");
    expect(body).toContain("border: 1px solid var(--command-palette-border, var(--border))");
    expect(body).toContain("linear-gradient");
  });

  it("card frame items float with rounded selection inside the list padding", () => {
    const itemBody = ruleBody(
      '[data-slot="command-palette-content"][data-frame="card"] [data-slot="command-palette-item"]',
    );
    expect(itemBody).not.toBeNull();
    expect(itemBody).toContain("margin: 0 var(--command-palette-list-p)");
    expect(itemBody).toContain("border-radius: 6px");

    const selectedBody = ruleBody(
      '[data-slot="command-palette-content"][data-frame="card"] [data-slot="command-palette-item"][aria-selected="true"]',
    );
    expect(selectedBody).not.toBeNull();
    expect(selectedBody).toContain(
      "background: color-mix(in oklab, var(--command-palette-fg, var(--foreground)) 8%, transparent)",
    );
  });
});
