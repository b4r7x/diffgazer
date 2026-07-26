import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { bodyMarkup, mountLanding } from "../testing/markup";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "index.css"), "utf8");

describe("landing footer bracket pairs", () => {
  beforeEach(() => {
    mountLanding();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
  });

  it("wraps between the bracketed links, never inside one", () => {
    // "[ MIT License ]" split across two lines at 390 and read as a rendering
    // bug: a bracket pair is one mark.
    const row = document.querySelector<HTMLElement>(".foot-links");
    const license = document.querySelector<HTMLElement>('.foot-links a[data-link="license"]');
    if (!row || !license) throw new Error("footer links not in the shipped markup");

    expect(getComputedStyle(license).whiteSpace).toBe("nowrap");
    expect(getComputedStyle(row).flexWrap).toBe("wrap");
  });
});

describe("landing hero diff line handling", () => {
  it("opts out of the DiffView wrap default", () => {
    // The primitive soft-wraps at coarse pointer and below 40rem. The hero
    // truncates instead (the ≤700px block below), and the two triggers together
    // clipped the first 2ch of every line — 'import' rendered as 'nport'.
    const hero = /<figure[^>]*id="gz-diff-view"[^>]*>/.exec(bodyMarkup())?.[0] ?? "";

    expect(hero).toContain('data-wrap="off"');
  });

  it("still truncates on an ellipsis at the hero breakpoint", () => {
    // jsdom has no viewport to evaluate the 700px query against, so this one
    // stays a source check: the declaration is the contract.
    const at = css.indexOf(".gaze-diff .diff-code { overflow: hidden;");

    expect(at, "no truncation rule for the hero diff").toBeGreaterThan(-1);
    expect(css.indexOf("@media (max-width: 700px)")).toBeLessThan(at);
    expect(css.slice(at, css.indexOf("}", at))).toContain("text-overflow: ellipsis");
  });
});
