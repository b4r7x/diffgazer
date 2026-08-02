import "./model-select-overlay.terminal-mock";
import type { BoundApi } from "@diffgazer/core/api";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { escapeRegExp } from "../../../testing/escape-regexp";
import { ModelSelectOverlay } from "./model-select-overlay";
import {
  ARROW_DOWN,
  countPrefixes,
  flush,
  flushUntil,
  GEMINI_CONFIGURATION,
  geminiName,
  makeGeminiApi,
  makeQueryClient,
  testDiscoveryResponse,
  Wrapper,
} from "./model-select-overlay.test-support";

describe("ModelSelectOverlay selection (Enter -> onSelect -> close)", () => {
  afterEach(() => {
    cleanup();
  });

  test("selects the discovered model on Enter and closes the overlay", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open
          onOpenChange={onOpenChange}
          configuration={GEMINI_CONFIGURATION}
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);

    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("stays open and pending until the selection mutation settles", async () => {
    const deferred = createDeferred<void>();
    const onSelect = vi.fn(() => deferred.promise);
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open
          onOpenChange={onOpenChange}
          configuration={GEMINI_CONFIGURATION}
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Saving") ?? false);
    expect(onOpenChange).not.toHaveBeenCalled();

    deferred.resolve();
    await flushUntil(() => onOpenChange.mock.calls.length > 0);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("keeps the overlay open and reports a rejected selection in place", async () => {
    const onSelect = vi.fn(() => Promise.reject(new Error("Model select was rejected")));
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open
          onOpenChange={onOpenChange}
          configuration={GEMINI_CONFIGURATION}
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Model select was rejected") ?? false);

    expect(lastFrame()).toContain("Select Model");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("ignores a second Enter while the first selection is still pending", async () => {
    const deferred = createDeferred<void>();
    const onSelect = vi.fn(() => deferred.promise);
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={GEMINI_CONFIGURATION}
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Saving") ?? false);
    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledTimes(1);
    deferred.resolve();
  });
});

describe("ModelSelectOverlay saving state", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the Saving spinner and freezes navigation while selection is pending", async () => {
    const deferred = createDeferred<void>();
    const onSelect = vi.fn(() => deferred.promise);
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={GEMINI_CONFIGURATION}
          onSelect={onSelect}
          isSaving
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write(ARROW_DOWN);
    await flush();
    expect(countPrefixes(lastFrame(), geminiName("gemini-2.5-flash")).highlighted).toBe(1);
  });

  test("ignores Escape while model selection is pending", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open
          onOpenChange={onOpenChange}
          configuration={GEMINI_CONFIGURATION}
          isSaving
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Saving") ?? false);
    stdin.write("\u001B");
    await flush();
    expect(lastFrame()).toContain("Select Model");
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("ModelSelectOverlay stale discovery", () => {
  afterEach(() => {
    cleanup();
  });

  test("rejects a stale configuration tuple and keeps retry available", async () => {
    const staleConfiguration = {
      ...GEMINI_CONFIGURATION,
      endpoint: "https://generativelanguage.googleapis.com/v1beta-stale",
    };
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(testDiscoveryResponse(staleConfiguration));
    const api = { ...makeGeminiApi(), testConfiguration } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(
      () =>
        lastFrame()?.includes("Model discovery returned a different configuration tuple.") ?? false,
    );
    expect(lastFrame()).toContain("Press r to retry");
  });

  test("clears discovery errors when the configuration changes while open", async () => {
    const queryClient = makeQueryClient();
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockRejectedValueOnce(new Error("Model discovery failed. Test the configuration again."))
      .mockImplementation(async () =>
        testDiscoveryResponse({ ...GEMINI_CONFIGURATION, revision: 2 }),
      );
    const api = { ...makeGeminiApi(), testConfiguration } satisfies BoundApi;

    const view = render(
      <Wrapper api={api} queryClient={queryClient}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Model discovery failed") ?? false);
    view.rerender(
      <Wrapper api={api} queryClient={queryClient}>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={{ ...GEMINI_CONFIGURATION, revision: 2 }}
        />
      </Wrapper>,
    );
    await flushUntil(() => view.lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    expect(view.lastFrame()).not.toContain("Model discovery failed");
  });
});

describe("ModelSelectOverlay selected marker", () => {
  afterEach(() => {
    cleanup();
  });

  test("marks exactly the selectedId row as the current model", async () => {
    const { lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={GEMINI_CONFIGURATION}
          selectedId="gemini-2.5-flash"
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const selectedName = geminiName("gemini-2.5-flash");
    const frame = lastFrame() ?? "";
    const escapedSelected = escapeRegExp(selectedName);
    expect(frame.match(new RegExp(`\\[\\*\\]\\s+${escapedSelected}`)) ?? []).toHaveLength(1);
    expect((frame.match(/\[\*\]/g) ?? []).length).toBe(1);
  });
});
