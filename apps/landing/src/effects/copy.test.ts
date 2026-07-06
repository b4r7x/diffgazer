import { afterEach, describe, expect, it, vi } from "vitest";
import { initCopyButtons } from "./copy";

function mountButton(): HTMLElement {
  document.body.innerHTML = `<button class="copy-btn" data-copy="npm install -g diffgazer"><span class="copy-label">copy</span></button>`;
  const button = document.querySelector<HTMLElement>(".copy-btn");
  if (!button) throw new Error("copy button not mounted");
  return button;
}

describe("initCopyButtons", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("copies the payload and flips the label copy -> copied -> copy", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const button = mountButton();
    initCopyButtons(document, 1400);
    const label = button.querySelector<HTMLElement>(".copy-label");

    button.click();

    // Flush the click handler's clipboard await without advancing the revert.
    await vi.advanceTimersByTimeAsync(0);
    expect(writeText).toHaveBeenCalledWith("npm install -g diffgazer");
    expect(label?.textContent).toBe("copied");

    await vi.advanceTimersByTimeAsync(1400);
    expect(label?.textContent).toBe("copy");
  });

  it("reports failure when the clipboard is unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", {});

    const button = mountButton();
    initCopyButtons(document);
    const label = button.querySelector<HTMLElement>(".copy-label");

    button.click();

    await vi.advanceTimersByTimeAsync(0);
    expect(label?.textContent).toBe("failed");

    await vi.advanceTimersByTimeAsync(1400);
    expect(label?.textContent).toBe("copy");
  });

  it("does not update the label after cleanup while clipboard write is pending", async () => {
    vi.useFakeTimers();
    let resolveWrite: (() => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const button = mountButton();
    const cleanup = initCopyButtons(document, 1400);
    const label = button.querySelector<HTMLElement>(".copy-label");

    button.click();
    cleanup();
    resolveWrite?.();

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1400);

    expect(label?.textContent).toBe("copy");
  });
});
