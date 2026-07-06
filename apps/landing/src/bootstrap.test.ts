import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "./bootstrap";
import { demoFindings, formatFindingSummary, gazeFindings } from "./demo";
import { resolveLinks } from "./env";
import { mountLanding } from "./testing/markup";

let cleanup = () => {};

function stubReducedMotion(): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

// jsdom cannot lay out or paint, so color-contrast is unreliable; and the fixed
// decorative HUD legitimately renders outside a landmark, which the best-practice
// "region" rule forbids. Both are disabled so the run stays focused on structural
// accessibility: roles, accessible names, and ARIA usage.
async function runAxe(target: Element): Promise<axe.AxeResults> {
  return axe.run(target, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
}

describe("bootstrap under reduced motion", () => {
  beforeEach(() => {
    stubReducedMotion();
    mountLanding();
    cleanup = bootstrap(document);
  });

  afterEach(() => {
    cleanup();
    cleanup = () => {};
    vi.unstubAllGlobals();
  });

  it("lights every changed diff row and pins both callouts", () => {
    const lit = document.querySelectorAll(
      '[data-row][data-state="removed"].lit, [data-row][data-state="added"].lit',
    );
    expect(lit.length).toBeGreaterThan(0);
    expect(document.querySelector("#gz-co-0")?.classList.contains("on")).toBe(true);
    expect(document.querySelector("#gz-co-1")?.classList.contains("on")).toBe(true);
  });

  it("reveals the full headline and keeps its accessible name", () => {
    const chars = document.querySelectorAll("#h1 .ch");
    const revealed = document.querySelectorAll("#h1 .ch.on");
    expect(chars.length).toBeGreaterThan(0);
    expect(revealed.length).toBe(chars.length);
    expect(document.querySelector("#h1")?.getAttribute("aria-label")).toBe("Local AI code review.");
  });

  it("settles the tagline diff-beat on machine", () => {
    expect(document.querySelector("#swap s")?.classList.contains("lit")).toBe(true);
    expect(document.querySelector("#swap ins")?.textContent).toBe("machine.");
  });

  it("fills every terminal line", () => {
    const lines = [...document.querySelectorAll<HTMLElement>(".term-line")];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.textContent).toBe(line.dataset.line);
    }
  });

  it("wires env links to their resolved destinations", () => {
    const { docs, github } = resolveLinks();
    for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[data-link="docs"]')) {
      expect(anchor.getAttribute("href")).toBe(docs);
    }
    for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[data-link="github"]')) {
      expect(anchor.getAttribute("href")).toBe(github);
    }
  });

  it("moves finding selection from the keyboard", () => {
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");
    const weightedScoreFinding = demoFindings.find((finding) => finding.tag === "correctness");

    expect(selected()?.textContent).toContain(demoFindings[0].title);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));

    expect(weightedScoreFinding).toBeDefined();
    expect(selected()?.textContent).toContain(weightedScoreFinding?.title);
    expect(document.querySelector("#finding-detail")?.textContent).toContain(
      weightedScoreFinding?.body,
    );
  });

  it("renders demo finding summaries and callouts from the shared data source", () => {
    expect(document.querySelector("#findings-summary")?.textContent).toBe(
      formatFindingSummary(demoFindings),
    );
    expect(document.querySelector("#gz-co-0")?.textContent).toContain(gazeFindings[0].title);
    expect(document.querySelector("#gz-co-1")?.textContent).toContain(gazeFindings[1].title);
  });

  it("exposes vertical tab semantics for findings navigation", () => {
    const tablist = document.querySelector<HTMLElement>("#findings-list");
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");

    expect(tablist?.getAttribute("aria-orientation")).toBe("vertical");

    selected()?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));

    expect(selected()?.textContent).toContain(demoFindings.at(-1)?.title);
  });

  it("makes the mobile diff scroller keyboard focusable", () => {
    const diffRows = document.querySelector<HTMLElement>("#gz-diff");

    expect(diffRows?.tabIndex).toBe(0);
    expect(diffRows?.getAttribute("aria-label")).toBe("Example diff rows");
  });

  it("labels duplicate copy buttons with their target action", () => {
    const labels = [...document.querySelectorAll<HTMLButtonElement>(".copy-btn")].map((button) =>
      button.getAttribute("aria-label"),
    );

    expect(labels).toEqual(["Copy install command", "Copy install command"]);
  });

  it("has no structural accessibility violations", async () => {
    expect(await runAxe(document.body)).toHaveNoViolations();
  });
});
