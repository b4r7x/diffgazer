import { afterEach, describe, expect, it, vi } from "vitest";
import { mountLanding } from "../testing/markup";
import { initCopyButtons, initPackageManagerSwitch } from "./copy";

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function createDeferred(): Deferred {
  let resolve: () => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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

  it("keeps the newest result when overlapping clipboard writes settle out of order", async () => {
    vi.useFakeTimers();
    const firstWrite = createDeferred();
    const secondWrite = createDeferred();
    const writeText = vi
      .fn()
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const button = mountButton();
    initCopyButtons(document, 1400);
    const label = button.querySelector<HTMLElement>(".copy-label");

    button.click();
    button.click();
    secondWrite.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(label?.textContent).toBe("copied");

    firstWrite.reject(new Error("stale clipboard failure"));
    await vi.advanceTimersByTimeAsync(0);
    expect(label?.textContent).toBe("copied");
  });

  it("restarts the revert timer for the newest operation", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const button = mountButton();
    initCopyButtons(document, 1400);
    const label = button.querySelector<HTMLElement>(".copy-label");

    button.click();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    button.click();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(400);
    expect(label?.textContent).toBe("copied");

    await vi.advanceTimersByTimeAsync(1000);
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

describe("initPackageManagerSwitch", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  function mountInstallScene(): void {
    mountLanding();
  }

  function scene(): HTMLElement {
    const section = document.querySelector<HTMLElement>("#s6");
    if (!section) throw new Error("install scene not mounted");
    return section;
  }

  function pmButton(name: string): HTMLButtonElement {
    const button = [...scene().querySelectorAll<HTMLButtonElement>(".pm-btn")].find((candidate) =>
      candidate.textContent?.includes(name),
    );
    if (!button) throw new Error(`missing ${name} button`);
    return button;
  }

  function shownCommand(): string {
    return scene().querySelector<HTMLElement>(".install-cmd-text")?.textContent ?? "";
  }

  function copyButton(): HTMLButtonElement {
    const button = scene().querySelector<HTMLButtonElement>(".copy-btn");
    if (!button) throw new Error("copy button missing");
    return button;
  }

  it("ships npm as the pressed default", () => {
    mountInstallScene();
    initPackageManagerSwitch(document);

    expect(pmButton("npm").getAttribute("aria-pressed")).toBe("true");
    expect(pmButton("pnpm").getAttribute("aria-pressed")).toBe("false");
    expect(pmButton("bun").getAttribute("aria-pressed")).toBe("false");
    expect(shownCommand()).toBe("npm install -g diffgazer");
  });

  it("rewrites the shown command and the copied payload together", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    mountInstallScene();
    initPackageManagerSwitch(document);
    initCopyButtons(document, 1400);

    pmButton("pnpm").click();

    expect(shownCommand()).toBe("pnpm add -g diffgazer");
    expect(
      [...scene().querySelectorAll<HTMLButtonElement>(".pm-btn")].filter(
        (button) => button.getAttribute("aria-pressed") === "true",
      ),
    ).toHaveLength(1);

    copyButton().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(writeText).toHaveBeenCalledWith("pnpm add -g diffgazer");
  });

  it("clears a stale copied label when the manager changes", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    mountInstallScene();
    initPackageManagerSwitch(document);
    initCopyButtons(document, 1400);

    copyButton().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(copyButton().querySelector(".copy-label")?.textContent).toBe("copied");

    pmButton("bun").click();
    expect(copyButton().querySelector(".copy-label")?.textContent).toBe("copy");
    expect(shownCommand()).toBe("bun add -g diffgazer");
  });

  it("leaves the hero install row on npm", () => {
    mountInstallScene();
    initPackageManagerSwitch(document);

    pmButton("pnpm").click();

    const heroCopy = document.querySelector<HTMLElement>("#s1 .copy-btn");
    expect(heroCopy?.dataset.copy).toBe("npm install -g diffgazer");
  });

  it("stops mutating the command after cleanup", () => {
    mountInstallScene();
    const cleanup = initPackageManagerSwitch(document);

    cleanup();
    pmButton("pnpm").click();

    expect(shownCommand()).toBe("npm install -g diffgazer");
  });
});
