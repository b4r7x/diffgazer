import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "./bootstrap";
import { demoFindings, formatFindingSummary, gazeFindings } from "./demo";
import { resolveLinks } from "./links";
import { mountLanding } from "./testing/markup";

let cleanup = () => {};

function stubMotionPreference(initialReduced: boolean) {
  let reduced = initialReduced;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const reducedQuery = {
    get matches() {
      return reduced;
    },
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };

  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("prefers-reduced-motion")
      ? reducedQuery
      : { ...reducedQuery, matches: true, media: query },
  );

  return {
    setReduced(next: boolean) {
      reduced = next;
      const event = { matches: next, media: reducedQuery.media } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}

function stubReducedMotion(): void {
  stubMotionPreference(true);
}

function stubCanvasContext() {
  const fillText = vi.fn();
  const context: CanvasRenderingContext2D = Object.assign(Object.create(null), {
    clearRect: vi.fn(),
    fillText,
    setTransform: vi.fn(),
    font: "",
    textBaseline: "alphabetic" as CanvasTextBaseline,
    globalAlpha: 1,
    fillStyle: "#000000",
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context);
  return { fillText };
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
    const { docs, github } = resolveLinks(import.meta.env);
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

describe("bootstrap motion preference changes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mountLanding();
  });

  afterEach(() => {
    cleanup();
    cleanup = () => {};
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("repaints the reduced-motion field after resize resets the canvas buffer", async () => {
    const { fillText } = stubCanvasContext();
    stubReducedMotion();
    cleanup = bootstrap(document);
    const initialPaintCount = fillText.mock.calls.length;

    window.dispatchEvent(new Event("resize"));
    await vi.advanceTimersByTimeAsync(150);

    expect(initialPaintCount).toBeGreaterThan(0);
    expect(fillText.mock.calls.length).toBeGreaterThan(initialPaintCount);
  });

  it("restores the native cursor and settles animation work when reduction turns on", async () => {
    const pendingFrames: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    const motion = stubMotionPreference(false);

    cleanup = bootstrap(document);
    expect(document.documentElement.classList.contains("reticle-on")).toBe(true);

    motion.setReduced(true);

    expect(document.documentElement.classList.contains("reticle-on")).toBe(false);
    expect(document.querySelector("#reticle")?.classList.contains("on")).toBe(false);
    expect(document.querySelector("#reticle")?.classList.contains("lock")).toBe(false);

    const scheduledBeforeFlush = requestFrame.mock.calls.length;
    for (const frame of pendingFrames.splice(0)) frame(performance.now());
    await vi.runOnlyPendingTimersAsync();

    expect(requestFrame).toHaveBeenCalledTimes(scheduledBeforeFlush);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("landing deployment 404 contract", () => {
  const nginxConfig = readFileSync(
    resolve(process.cwd(), "../../deploy/landing-nginx.conf"),
    "utf8",
  );
  const notFoundHtml = readFileSync(resolve(process.cwd(), "404.html"), "utf8");
  const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  const styles = readFileSync(resolve(process.cwd(), "src/styles/index.css"), "utf8");

  it("serves unknown paths as real 404 responses instead of the landing page", () => {
    const rootLocation = nginxConfig.match(/location \/ \{([\s\S]*?)\n {4}\}/)?.[1];

    expect(rootLocation).toBeDefined();
    expect(rootLocation).toMatch(/try_files \$uri \$uri\/ =404;/);
    expect(rootLocation).not.toContain("/index.html");
    expect(nginxConfig).toMatch(/error_page 404 \/404\.html;/);
    expect(nginxConfig).toMatch(/location = \/404\.html \{[\s\S]*?internal;/);
  });

  it("uses immutable caching only for content-hashed Vite assets", () => {
    const immutableBlock = nginxConfig.match(/location \^~ \/assets\/ \{([\s\S]*?)\n {4}\}/)?.[1];
    const fixedAssetBlock = nginxConfig.match(
      /location ~\* \\.\(js\|css\|png\|jpg\|gif\|ico\|svg\|woff2\?\|ttf\|eot\)\$ \{([\s\S]*?)\n {4}\}/,
    )?.[1];

    expect(immutableBlock).toContain('Cache-Control "public, max-age=31536000, immutable"');
    expect(fixedAssetBlock).toContain('Cache-Control "public, max-age=0, must-revalidate"');
    expect(fixedAssetBlock).not.toContain("immutable");
    expect(indexHtml).toContain('href="/favicon.ico"');
    expect(indexHtml).toContain("/og.png");
    expect(styles).toContain('url("/fonts/DepartureMono-Regular.woff2")');
  });

  it("ships an accessible branded 404 document for the nginx error response", () => {
    const page = new DOMParser().parseFromString(notFoundHtml, "text/html");

    expect(page.title).toMatch(/404.*Diffgazer/i);
    expect(page.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("noindex");
    expect(page.querySelector("main")).not.toBeNull();
    expect(page.querySelector("h1")?.textContent).toMatch(/page not found/i);
    expect(page.querySelector('a[href="/"]')?.textContent).toMatch(/home/i);
    expect(page.querySelector('a[href="%VITE_DOCS_ORIGIN%"]')).not.toBeNull();
    expect(page.querySelector('a[href="%VITE_GITHUB_URL%"]')).not.toBeNull();
  });
});
