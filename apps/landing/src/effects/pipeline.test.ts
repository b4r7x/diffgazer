import { afterEach, describe, expect, it, vi } from "vitest";
import { formatFindingSummary, pipelineFindings } from "../demo";
import { mountLanding } from "../testing/markup";
import { initPipeline } from "./pipeline";

const animatedFlags = { reduced: false, finePointer: true };
const VIEWPORT_HEIGHT = 800;
const TRACK = 1000;

/** Drive the pinned-scroll track to `progress` and let the scrub run. */
function scrollTo(progress: number): void {
  const wrap = document.querySelector<HTMLElement>("#s3-wrap");
  if (!wrap) throw new Error("#s3-wrap not in the shipped markup");
  wrap.getBoundingClientRect = () =>
    ({ height: VIEWPORT_HEIGHT + TRACK, top: -progress * TRACK }) as DOMRect;
  dispatchEvent(new Event("scroll"));
}

function stepStates(): { classes: string; time: string }[] {
  return [...document.querySelectorAll<HTMLElement>(".rp-step")].map((step) => ({
    classes: step.className,
    time: step.querySelector<HTMLElement>(".t")?.textContent ?? "",
  }));
}

const text = (id: string): string =>
  document.querySelector<HTMLElement>(`#${id}`)?.textContent ?? "";

const litFindings = (): number => document.querySelectorAll("#rp-findings .rp-find.on").length;

describe("initPipeline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("returns an idempotent cleanup that detaches the parent abort listener without markup", () => {
    const parent = new AbortController();
    const removeEventListener = vi.spyOn(parent.signal, "removeEventListener");
    const cleanup = initPipeline(document.createElement("div"), undefined, parent.signal);

    cleanup();
    cleanup();

    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledWith("abort", cleanup);

    parent.abort();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });

  describe("scrubbed across the pinned track", () => {
    function mountPipeline(): () => void {
      mountLanding();
      vi.stubGlobal("innerWidth", 1200);
      vi.stubGlobal("innerHeight", VIEWPORT_HEIGHT);
      return initPipeline(document, animatedFlags);
    }

    it("holds every step queued before the track starts", () => {
      const cleanup = mountPipeline();
      scrollTo(0);

      expect(stepStates().every((step) => !step.classes.includes("run"))).toBe(true);
      expect(stepStates().every((step) => step.time === "")).toBe(true);
      expect(text("rp-status")).toBe("queued");
      expect(text("rp-foot")).toBe("scroll to run the review");
      expect(text("rp-glyph")).toBe("○");
      expect(litFindings()).toBe(0);

      cleanup();
    });

    it("runs one step at a time and stamps a duration once it is behind", () => {
      const cleanup = mountPipeline();
      scrollTo(0.3);

      const steps = stepStates();
      expect(steps[0]?.classes).toContain("done");
      expect(steps[0]?.time).toBe("212ms");
      expect(steps[1]?.classes).toContain("run");
      expect(steps[1]?.time).toBe("");
      expect(steps[2]?.classes).not.toContain("run");
      expect(text("rp-status")).toBe("running");
      expect(text("rp-foot")).toBe("streaming events…");

      cleanup();
    });

    it("streams the findings in while the review step is active", () => {
      const cleanup = mountPipeline();

      scrollTo(0.4);
      expect(litFindings()).toBe(0);

      scrollTo(0.5);
      expect(litFindings()).toBe(1);

      scrollTo(0.7);
      expect(litFindings()).toBe(pipelineFindings.length);

      cleanup();
    });

    it("completes the header on the same progress that finishes the last step", () => {
      const cleanup = mountPipeline();
      scrollTo(0.9);

      expect(stepStates().every((step) => step.classes.includes("done"))).toBe(true);
      expect(text("rp-glyph")).toBe("✓");
      expect(text("rp-status")).toBe("complete");
      expect(text("rp-foot")).toBe("review complete");
      expect(text("rp-meta")).toBe(`4 steps · ${formatFindingSummary(pipelineFindings)}`);

      cleanup();
    });

    it("leaves the summary blank while the last step is still running", () => {
      const cleanup = mountPipeline();
      scrollTo(0.85);

      expect(text("rp-status")).toBe("running");
      expect(text("rp-meta")).toBe("");

      cleanup();
    });
  });
});
