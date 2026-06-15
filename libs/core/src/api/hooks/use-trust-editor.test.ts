/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrustConfig } from "../../schemas/config/index.js";
import type { BoundApi } from "../bound.js";
import { ApiProvider } from "./context.js";
import { TRUST_EDITOR_MESSAGES, useTrustEditor } from "./use-trust-editor.js";

const TRUSTED_AT = "2026-05-13T12:00:00.000Z";

function makeTrust(overrides: Partial<TrustConfig> = {}): TrustConfig {
  return {
    projectId: "proj-1",
    repoRoot: "/work/proj",
    trustedAt: TRUSTED_AT,
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
    ...overrides,
  };
}

function makeWrapper(api: BoundApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
}

function makeCallbacks() {
  return { onSaved: vi.fn(), onRevoked: vi.fn(), onError: vi.fn() };
}

describe("useTrustEditor", () => {
  let saveTrust: ReturnType<typeof vi.fn>;
  let deleteTrust: ReturnType<typeof vi.fn>;
  let api: BoundApi;

  beforeEach(() => {
    saveTrust = vi.fn(async (trust: TrustConfig) => ({ trust }));
    deleteTrust = vi.fn(async () => ({ removed: true }));
    api = { saveTrust, deleteTrust } as unknown as BoundApi;
  });

  it("exposes the persisted capabilities and trusted state from the editor input", () => {
    const { result } = renderHook(
      () =>
        useTrustEditor(
          { projectId: "proj-1", repoRoot: "/work/proj", trust: makeTrust() },
          makeCallbacks(),
        ),
      { wrapper: makeWrapper(api) },
    );
    expect(result.current.capabilities).toEqual({ readFiles: true, runCommands: false });
    expect(result.current.isTrusted).toBe(true);
  });

  it("keeps the local draft across rerenders with the same editor key", () => {
    const input = { projectId: "proj-1", repoRoot: "/work/proj", trust: makeTrust() };
    const { result, rerender } = renderHook(() => useTrustEditor(input, makeCallbacks()), {
      wrapper: makeWrapper(api),
    });
    act(() => result.current.handleCapabilitiesChange({ readFiles: false, runCommands: false }));
    expect(result.current.capabilities.readFiles).toBe(false);
    rerender();
    expect(result.current.capabilities.readFiles).toBe(false);
  });

  it("resets the draft when the editor key changes (trust refreshed)", () => {
    const callbacks = makeCallbacks();
    const { result, rerender } = renderHook(
      ({ trust }: { trust: TrustConfig }) =>
        useTrustEditor({ projectId: "proj-1", repoRoot: "/work/proj", trust }, callbacks),
      { wrapper: makeWrapper(api), initialProps: { trust: makeTrust() } },
    );
    act(() => result.current.handleCapabilitiesChange({ readFiles: false, runCommands: false }));
    expect(result.current.capabilities.readFiles).toBe(false);
    rerender({ trust: makeTrust({ trustedAt: "2026-05-13T13:00:00.000Z" }) });
    expect(result.current.capabilities.readFiles).toBe(true);
  });

  it("saves the current capabilities and reports success", async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(
      () =>
        useTrustEditor(
          { projectId: "proj-1", repoRoot: "/work/proj", trust: makeTrust() },
          callbacks,
        ),
      { wrapper: makeWrapper(api) },
    );
    act(() => result.current.handleSave());
    await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledTimes(1));
    expect(saveTrust).toHaveBeenCalledWith({
      capabilities: { readFiles: true },
      trustMode: "persistent",
    });
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("reports the blocked message when project identity is missing", () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(
      () => useTrustEditor({ projectId: null, repoRoot: null, trust: null }, callbacks),
      { wrapper: makeWrapper(api) },
    );
    act(() => result.current.handleSave());
    expect(callbacks.onError).toHaveBeenCalledWith(TRUST_EDITOR_MESSAGES.blocked);
    expect(saveTrust).not.toHaveBeenCalled();
  });

  it("revokes trust, clears capabilities and reports success", async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(
      () =>
        useTrustEditor(
          { projectId: "proj-1", repoRoot: "/work/proj", trust: makeTrust() },
          callbacks,
        ),
      { wrapper: makeWrapper(api) },
    );
    act(() => result.current.handleRevoke());
    await waitFor(() => expect(callbacks.onRevoked).toHaveBeenCalledTimes(1));
    expect(deleteTrust).toHaveBeenCalledWith();
    await waitFor(() => expect(result.current.capabilities.readFiles).toBe(false));
  });

  it("surfaces the save failure message", async () => {
    saveTrust.mockRejectedValueOnce(new Error("boom"));
    const callbacks = makeCallbacks();
    const { result } = renderHook(
      () =>
        useTrustEditor(
          { projectId: "proj-1", repoRoot: "/work/proj", trust: makeTrust() },
          callbacks,
        ),
      { wrapper: makeWrapper(api) },
    );
    act(() => result.current.handleSave());
    await waitFor(() => expect(callbacks.onError).toHaveBeenCalledWith("boom"));
  });

  it("exposes the canonical feedback strings", () => {
    expect(TRUST_EDITOR_MESSAGES).toEqual({
      blocked: "Project information not available",
      saved: "Trust permissions updated",
      saveFailed: "Failed to save trust settings",
      revoked: "Trust has been revoked for this repository",
      revokeFailed: "Failed to revoke trust",
    });
  });
});
