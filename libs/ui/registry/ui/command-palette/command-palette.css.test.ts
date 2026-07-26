import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { atRuleBody, ruleBody } from "../../testing/css-contract";

describe("CommandPalette CSS contract", () => {
  // jsdom's CSSOM ignores rules nested in @layer and pseudo-element styles, so
  // assert the CSS contract by parsing the source selectors/declarations directly.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../command-palette.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  it("viewfinder highlight draws a 2px left accent bar via ::after", () => {
    const body = ruleBody(
      css,
      '[data-slot="command-palette-content"][data-frame="viewfinder"] [data-slot="command-palette-item"][data-highlighted]::after',
    );
    expect(body).toContain('content: ""');
    expect(body).toContain("width: 2px");
  });

  it("routes every floating frame shadow through the single hard-shadow token plus the shared lip", () => {
    for (const frame of ["border", "viewfinder", "terminal", "card"]) {
      const body = ruleBody(css, `[data-slot="command-palette-content"][data-frame="${frame}"]`);
      // Modal overlay tier: the shared --surface-1 inner lip composited with the
      // library's only sanctioned drop shadow, in one box-shadow so neither wins.
      expect(body).toContain("inset 0 1px 0 var(--surface-1-highlight)");
      expect(body).toContain("var(--command-palette-shadow, var(--shadow-hard))");
    }
    // Nothing may hand-roll a black shadow beside the token.
    expect(css).not.toContain("oklch(0% 0 0");
  });

  it("leaves the bare embedding frame without a shadow", () => {
    expect(ruleBody(css, '[data-slot="command-palette-content"][data-frame="none"]')).toContain(
      "box-shadow: none",
    );
  });

  it("declares the shared viewfinder corner knob instead of hardcoding geometry", () => {
    const body = ruleBody(css, '[data-slot="command-palette-content"][data-frame="viewfinder"]');
    expect(body).toContain("--viewfinder-size: 18px");
    expect(body).toContain("--viewfinder-weight: 2px");
    expect(body).toContain("--viewfinder-offset: -1px");
  });

  it("expands the Esc close control to a 44px touch target without moving its chip", () => {
    const body = ruleBody(css, '[data-slot="command-palette-close"]::before');
    expect(body).toContain("min-width: 44px");
    expect(body).toContain("min-height: 44px");
    // Anchored to the chip's leading edge, so the extra width grows away from
    // the readout and the input instead of overhanging them.
    expect(body).toContain("inset-inline-start: 0");
  });

  it("floors the search input font-size at 16px on coarse pointers", () => {
    // Below 16px iOS Safari zooms the page on focus and never zooms back.
    const coarse = ruleBody(
      atRuleBody(css, "@media (pointer: coarse)"),
      '[data-slot="command-palette-input"] input',
    );
    expect(coarse).toContain("font-size: max(16px, var(--command-palette-text-size))");
  });

  it("keeps every font size on the rem scale so browser text preferences apply", () => {
    expect(css).not.toMatch(/font-size:\s*\d+px/);
    expect(css).not.toMatch(/--command-palette-(heading|prefix|text)-size:\s*\d+px/);
  });

  it("pads the footer past the home indicator with a safe fallback", () => {
    expect(ruleBody(css, '[data-slot="command-palette-footer"]')).toContain(
      "max(8px, env(safe-area-inset-bottom))",
    );
  });

  it("fills the palette from the shared overlay surface step, not the page background", () => {
    expect(ruleBody(css, '[data-slot="command-palette-content"]')).toContain(
      "background: var(--command-palette-bg, var(--surface-1))",
    );
  });

  it("switches the count readout to the error colour when the filter matched nothing", () => {
    expect(ruleBody(css, '[data-slot="command-palette-count"][data-empty]')).toContain(
      "color: var(--error)",
    );
  });

  it("disabled items hide the tone bar", () => {
    expect(
      ruleBody(css, '[data-slot="command-palette-item"][aria-disabled="true"]::before'),
    ).toContain("display: none");
  });
});
