import { afterEach, describe, expect, it, vi } from "vitest";
import { gazeFindings } from "../demo";
import { initGaze } from "./gaze";

function mountGaze(): void {
  document.body.innerHTML = `
    <div>
      <div id="gaze3d">
        <div id="gz-diff">
          <span data-row data-state="context"></span>
          <span data-row data-state="removed"></span>
          <span data-row data-state="added"></span>
          <span data-row data-target="0"></span>
          <span data-row data-target="1"></span>
        </div>
        <div id="gz-scan"></div>
        <span id="gz-spin"></span>
        <span id="gz-status"></span>
      </div>
      <div id="gz-co-0"></div>
      <div id="gz-co-1"></div>
    </div>`;
}

describe("initGaze", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("settles reduced motion issue count from the shared demo data", () => {
    mountGaze();

    const controller = initGaze(document, { reduced: true, finePointer: false });
    const issueCount: number = gazeFindings.length;
    const issueLabel = issueCount === 1 ? "issue" : "issues";

    expect(document.querySelector("#gz-status")?.textContent).toBe(`${issueCount} ${issueLabel}`);

    controller.cleanup();
  });

  it("stops the async scan loop when its abort signal fires", async () => {
    vi.useFakeTimers();
    mountGaze();

    const abort = new AbortController();
    const controller = initGaze(document, { reduced: false, finePointer: false }, abort.signal);
    const status = document.querySelector("#gz-status");

    abort.abort();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(status?.textContent).toBe("scanning");

    controller.cleanup();
  });

  it("does not animate gaze spinner or status for an already-aborted signal", async () => {
    vi.useFakeTimers();
    mountGaze();

    const abort = new AbortController();
    abort.abort();
    const spin = document.querySelector("#gz-spin");
    const status = document.querySelector("#gz-status");
    const initialSpin = spin?.textContent ?? "";
    const initialStatus = status?.textContent ?? "";

    const controller = initGaze(document, { reduced: false, finePointer: false }, abort.signal);

    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(spin?.textContent).toBe(initialSpin);
    expect(status?.textContent).toBe(initialStatus);
    expect(vi.getTimerCount()).toBe(0);

    controller.cleanup();

    expect(vi.getTimerCount()).toBe(0);
  });
});
