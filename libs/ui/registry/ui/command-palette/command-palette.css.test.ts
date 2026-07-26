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

  function whitespaceTolerant(fragment: string): string {
    return fragment
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+")
      .replace(/:not\\\(/g, ":not\\(\\s*")
      .replace(/\\\)/g, "\\s*\\)");
  }

  /** Text between the braces of `atRule`, brace-matched so nested rules stay intact. */
  function atRuleScope(atRule: string): string | null {
    const start = css.match(new RegExp(`${whitespaceTolerant(atRule)}\\s*\\{`));
    if (start?.index === undefined) return null;
    let depth = 1;
    const from = start.index + start[0].length;
    for (let i = from; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return css.slice(from, i);
      }
    }
    return null;
  }

  function ruleBody(selectorFragment: string, options?: { atRule?: string }): string | null {
    const source = options?.atRule ? atRuleScope(options.atRule) : css;
    if (source === null) return null;
    const match = source.match(
      new RegExp(`${whitespaceTolerant(selectorFragment)}\\s*\\{([^}]*)\\}`),
    );
    return match?.[1] ?? null;
  }

  it("viewfinder highlight draws a 2px left accent bar via ::after", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="viewfinder"] [data-slot="command-palette-item"][data-highlighted]::after',
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
    expect(body).toContain("font-size: var(--text-2xs)");
  });

  it("routes every floating frame shadow through the single hard-shadow token", () => {
    for (const frame of ["border", "viewfinder", "terminal", "card"]) {
      const body = ruleBody(`[data-slot="command-palette-content"][data-frame="${frame}"]`);
      expect(body).not.toBeNull();
      expect(body).toContain("box-shadow: var(--command-palette-shadow, var(--shadow-hard))");
    }
    expect(css).not.toContain("oklch(0% 0 0");
  });

  it("leaves the bare embedding frame without a shadow", () => {
    const body = ruleBody('[data-slot="command-palette-content"][data-frame="none"]');
    expect(body).toContain("box-shadow: none");
  });

  it("declares the shared viewfinder corner knob instead of hardcoding geometry", () => {
    const frameBody = ruleBody('[data-slot="command-palette-content"][data-frame="viewfinder"]');
    expect(frameBody).toContain("--viewfinder-size: 18px");
    expect(frameBody).toContain("--viewfinder-weight: 2px");
    expect(frameBody).toContain("--viewfinder-offset: -1px");

    // The four corner rules share one geometry block, so assert the knob is
    // read rather than re-hardcoded anywhere in the file.
    expect(css).toContain("width: var(--viewfinder-size)");
    expect(css).toContain("border: 0 solid var(--viewfinder-color)");
    expect(css).toContain("border-bottom-width: var(--viewfinder-weight)");
    expect(css).toContain("right: var(--viewfinder-offset)");
  });

  it("keeps every font size on the rem scale so browser text preferences apply", () => {
    expect(css).not.toMatch(/font-size:\s*\d+px/);
    expect(css).not.toMatch(/--command-palette-(heading|prefix|text)-size:\s*\d+px/);
  });

  it("tints the card footer from the palette foreground, never from raw black", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="card"] [data-slot="command-palette-footer"]',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("var(--command-palette-fg, var(--foreground)) 4%");
    expect(css).not.toContain("oklab, black");
  });

  it("terminal frame heading adopts the kebab padding and lighter weight", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="terminal"] [data-slot="command-palette-group-heading"]',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("font-weight: 400");
    expect(body).toContain("padding: 6px var(--command-palette-input-px) 2px");
  });

  it("terminal-frame highlighted row re-tints the tone bar to --command-palette-bg", () => {
    const body = ruleBody(
      '[data-slot="command-palette-content"][data-frame="terminal"] [data-slot="command-palette-item"][data-highlighted][data-tone]:not([data-tone="neutral"])::before',
    );
    expect(body).not.toBeNull();
    expect(body).toContain("background: var(--command-palette-bg, var(--background))");
  });

  it("collapses the list padding when nothing is rendered inside it", () => {
    const body = ruleBody('[data-slot="command-palette-list"]:empty');
    expect(body).not.toBeNull();
    expect(body).toContain("padding: 0");
  });

  it("disabled items hide the tone bar", () => {
    const body = ruleBody('[data-slot="command-palette-item"][aria-disabled="true"]::before');
    expect(body).not.toBeNull();
    expect(body).toContain("display: none");
  });

  it("floors the search input font-size at 16px on coarse pointers", () => {
    const base = ruleBody('[data-slot="command-palette-input"] input');
    expect(base).not.toBeNull();
    expect(base).toContain("font-size: var(--command-palette-text-size)");

    const coarse = ruleBody('[data-slot="command-palette-input"] input', {
      atRule: "@media (pointer: coarse)",
    });
    expect(coarse).not.toBeNull();
    expect(coarse).toContain("font-size: max(16px, var(--command-palette-text-size))");
  });

  it("card frame defines a rounded shell with a gradient surface", () => {
    const body = ruleBody('[data-slot="command-palette-content"][data-frame="card"]');
    expect(body).not.toBeNull();
    expect(body).toContain("border-radius: calc(var(--radius) * 2)");
    expect(body).toContain("border: 1px solid var(--command-palette-border, var(--border))");
    expect(body).toContain("linear-gradient");
  });

  it("card frame items float with a rounded highlight inside the list padding", () => {
    const itemBody = ruleBody(
      '[data-slot="command-palette-content"][data-frame="card"] [data-slot="command-palette-item"]',
    );
    expect(itemBody).not.toBeNull();
    expect(itemBody).toContain("margin: 0 var(--command-palette-list-p)");
    expect(itemBody).toContain("border-radius: calc(var(--radius) * 1.5)");

    const highlightedBody = ruleBody(
      '[data-slot="command-palette-content"][data-frame="card"] [data-slot="command-palette-item"][data-highlighted]',
    );
    expect(highlightedBody).not.toBeNull();
    expect(highlightedBody).toContain(
      "background: color-mix(in oklab, var(--command-palette-fg, var(--foreground)) 8%, transparent)",
    );
  });
});
