/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { acceptProviderConsent, type ProviderConsent } from "../../schemas/config/index.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import { useProviderConsentGate } from "./use-provider-consent-gate.js";

const RECORDED = acceptProviderConsent("2026-08-01T09:00:00.000Z");

function renderGate(consent: ProviderConsent | null, api: Partial<BoundApi> = {}) {
  const saveSettings = vi.fn<BoundApi["saveSettings"]>(async () => undefined);
  const { Wrapper } = createTestQueryWrapper({ api: { saveSettings, ...api } });
  const hook = renderHook(
    ({ recorded }: { recorded: ProviderConsent | null }) => useProviderConsentGate(recorded),
    { wrapper: Wrapper, initialProps: { recorded: consent } },
  );
  return { ...hook, saveSettings };
}

describe("useProviderConsentGate", () => {
  it("runs a gated action at once when the consent is on record", () => {
    const { result, saveSettings } = renderGate(RECORDED);
    const action = vi.fn();

    act(() => result.current.require(action));

    expect(action).toHaveBeenCalledOnce();
    expect(result.current.isOpen).toBe(false);
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("holds the action behind the notice, records the acceptance and then runs it", async () => {
    const { result, rerender, saveSettings } = renderGate(null);
    const action = vi.fn();

    act(() => result.current.require(action));
    expect(result.current).toMatchObject({ isOpen: true, readBack: null, continues: true });
    expect(action).not.toHaveBeenCalled();

    act(() => result.current.accept());
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(saveSettings).toHaveBeenCalledWith({
      providerConsent: { version: 1, acceptedAt: expect.any(String) },
    });
    // Closed, still offering the acceptance it was closed with; the recorded
    // consent arrives from the refetched settings.
    expect(result.current).toMatchObject({ isOpen: false, readBack: null, error: null });
    rerender({ recorded: RECORDED });
    expect(result.current.consent).toEqual(RECORDED);
  });

  it("keeps the notice open with the failure when the acceptance cannot be saved", async () => {
    const { result } = renderGate(null, {
      saveSettings: async () => {
        throw new Error("settings file is read-only");
      },
    });
    const action = vi.fn();

    act(() => result.current.require(action));
    act(() => result.current.accept());

    await waitFor(() => expect(result.current.error).toBe("settings file is read-only"));
    expect(result.current.isOpen).toBe(true);
    expect(action).not.toHaveBeenCalled();

    act(() => result.current.decline());
    expect(result.current).toMatchObject({ isOpen: false, error: null });
  });

  it("drops the held action on Not now", () => {
    const { result, saveSettings } = renderGate(null);
    const action = vi.fn();

    act(() => result.current.require(action));
    act(() => result.current.decline());

    expect(result.current.isOpen).toBe(false);
    expect(action).not.toHaveBeenCalled();
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("reads the recorded notice back on its own, with nothing to continue", () => {
    const { result } = renderGate(RECORDED);

    act(() => result.current.open());

    expect(result.current).toMatchObject({ isOpen: true, readBack: RECORDED, continues: false });
  });

  it("opens the notice on its own to accept it, with nothing to continue", async () => {
    const { result, saveSettings } = renderGate(null);

    act(() => result.current.open());
    expect(result.current).toMatchObject({ isOpen: true, readBack: null, continues: false });

    act(() => result.current.accept());
    await waitFor(() => expect(result.current.isOpen).toBe(false));
    expect(saveSettings).toHaveBeenCalledOnce();
  });
});
