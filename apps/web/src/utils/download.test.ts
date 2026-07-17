import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadAsFile } from "./download";

describe("downloadAsFile", () => {
  let liveUrls: Set<string>;
  let nextId: number;

  const preventJsdomNavigation = (event: MouseEvent) => {
    event.preventDefault();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    document.addEventListener("click", preventJsdomNavigation);
    liveUrls = new Set();
    nextId = 0;
    // jsdom does not implement the blob URL APIs; provide a minimal real
    // implementation that tracks which object URLs are still resolvable.
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => {
        const url = `blob:test/${nextId++}`;
        liveUrls.add(url);
        return url;
      }),
      revokeObjectURL: vi.fn((url: string) => {
        liveUrls.delete(url);
      }),
    });
  });

  afterEach(() => {
    document.removeEventListener("click", preventJsdomNavigation);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the blob URL resolvable while the download is initiated", () => {
    let urlAtClick: string | null = null;
    let urlWasLiveAtClick = false;

    // The browser reads the blob URL after click() returns; capture whether the
    // URL is still resolvable at the moment the anchor's click fires.
    document.addEventListener(
      "click",
      (event) => {
        const anchor = event.target as HTMLAnchorElement;
        urlAtClick = anchor.href;
        urlWasLiveAtClick = liveUrls.has(anchor.href);
      },
      { capture: true, once: true },
    );

    downloadAsFile("hello", "notes.txt");

    expect(urlAtClick).toMatch(/^blob:test\//);
    expect(urlWasLiveAtClick).toBe(true);
    // Still resolvable immediately after the call returns — not revoked in the
    // same task, so WebKit can fetch the blob.
    expect(liveUrls.has(urlAtClick ?? "")).toBe(true);
  });

  it("revokes the blob URL on a later tick", () => {
    downloadAsFile("hello", "notes.txt");
    const url = [...liveUrls][0];
    if (url === undefined) {
      throw new Error("Expected a live blob URL");
    }

    expect(liveUrls.has(url)).toBe(true);
    vi.runAllTimers();
    expect(liveUrls.has(url)).toBe(false);
  });

  it("does not leave the anchor in the document", () => {
    downloadAsFile("hello", "notes.txt");
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
