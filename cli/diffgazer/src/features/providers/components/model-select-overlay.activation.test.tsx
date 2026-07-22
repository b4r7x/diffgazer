import type { BoundApi } from "@diffgazer/core/api";
import type { ActivateProviderResponse } from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { escapeRegExp } from "../../../testing/escape-regexp";
import { ModelSelectOverlay } from "./model-select-overlay";
import {
  ARROW_DOWN,
  flush,
  flushUntil,
  geminiName,
  makeGeminiApi,
  makeQueryClient,
  StableWrapper,
  Wrapper,
  countPrefixes,
} from "./model-select-overlay.test-harness";

describe("ModelSelectOverlay selection (Enter -> activate -> close)", () => {
  afterEach(() => {
    cleanup();
  });

  test("activates the highlighted model on Enter, then calls onSelect with its id and closes after the activate mutation resolves", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockResolvedValue({ provider: "gemini", model: "gemini-2.5-flash" });
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    // The first model is highlighted by default; confirm Enter on it.
    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);

    expect(activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-flash");
    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ModelSelectOverlay saving state", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the Saving spinner and freezes the highlight while the activate mutation is pending", async () => {
    const deferred = createDeferred<ActivateProviderResponse>();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockReturnValue(deferred.promise);
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    const firstName = geminiName("gemini-2.5-flash");
    expect(countPrefixes(lastFrame(), firstName).highlighted).toBe(1);

    // Begin activation; the mutation never settles, so the overlay stays in the saving state.
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Saving") ?? false);

    expect(lastFrame()).toContain("Saving");

    // Arrow keys must be inert while saving: the highlight stays on the first model.
    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();

    expect(
      countPrefixes(lastFrame(), firstName).highlighted,
      `highlight should stay on the first model while saving. Frame: ${lastFrame()}`,
    ).toBe(1);
    const secondName = geminiName("gemini-2.5-flash-lite");
    expect(countPrefixes(lastFrame(), secondName).highlighted).toBe(0);
  });

  test("ignores Escape while model activation is pending", async () => {
    const deferred = createDeferred<ActivateProviderResponse>();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockReturnValue(deferred.promise);
    const onOpenChange = vi.fn();
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Saving") ?? false);
    stdin.write("\u001B");
    await flush();

    expect(lastFrame()).toContain("Select Model");
    expect(lastFrame()).toContain("Saving");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("keeps the failed row visible and navigable, then clears the error on retry", async () => {
    const onSelect = vi.fn();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockRejectedValueOnce(new Error("Activation failed: missing credentials"))
      .mockResolvedValueOnce({ provider: "gemini", model: "gemini-2.5-flash-lite" });
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Activation failed") ?? false);

    expect(lastFrame()).toContain("Activation failed: missing credentials");
    expect(lastFrame()).toContain(geminiName("gemini-2.5-flash"));
    expect(countPrefixes(lastFrame(), geminiName("gemini-2.5-flash")).highlighted).toBe(1);

    stdin.write(ARROW_DOWN);
    await flushUntil(
      () => countPrefixes(lastFrame(), geminiName("gemini-2.5-flash-lite")).highlighted === 1,
    );
    expect(lastFrame()).toContain("Activation failed: missing credentials");

    stdin.write("\r");
    await flushUntil(() => activateProvider.mock.calls.length === 2);
    await flushUntil(() => onSelect.mock.calls.length === 1);

    expect(activateProvider).toHaveBeenLastCalledWith("gemini", "gemini-2.5-flash-lite");
    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash-lite");
    expect(lastFrame()).not.toContain("Activation failed: missing credentials");
  });

  test("clears activation errors when the provider changes while open", async () => {
    const queryClient = makeQueryClient();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockRejectedValue(new Error("Activation failed: missing credentials"));
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const view = render(
      <StableWrapper api={api} queryClient={queryClient}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </StableWrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    view.stdin.write("\r");
    await flushUntil(() => view.lastFrame()?.includes("Activation failed") ?? false);

    view.rerender(
      <StableWrapper api={api} queryClient={queryClient}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="groq"
          onSelect={() => {}}
        />
      </StableWrapper>,
    );
    await flush();

    expect(view.lastFrame()).not.toContain("Activation failed");
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
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          selectedId="gemini-2.5-pro"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-pro")) ?? false);

    const selectedName = geminiName("gemini-2.5-pro");
    const frame = lastFrame() ?? "";
    const escapedSelected = escapeRegExp(selectedName);

    // The selected row renders the "[*]" check; every other row renders "[ ]".
    expect(frame.match(new RegExp(`\\[\\*\\]\\s+${escapedSelected}`)) ?? []).toHaveLength(1);
    expect(
      (frame.match(/\[\*\]/g) ?? []).length,
      `only one row should be marked selected. Frame: ${frame}`,
    ).toBe(1);
  });

  test("starts on a non-first selected model so Enter reselects the current model", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockResolvedValue({ provider: "gemini", model: "gemini-2.5-pro" });
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          selectedId="gemini-2.5-pro"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-pro")) ?? false);

    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);

    expect(activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-pro");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("restores the highlighted model when a filter temporarily hides it", async () => {
    const onSelect = vi.fn();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockResolvedValue({ provider: "gemini", model: "gemini-2.5-pro" });
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          selectedId="gemini-2.5-pro"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-pro")) ?? false);

    stdin.write("f");
    await flush();
    stdin.write("f");
    await flush();
    expect(lastFrame()).not.toContain(geminiName("gemini-2.5-pro"));

    stdin.write("f");
    await flush();
    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);

    expect(activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-pro");
  });
});
