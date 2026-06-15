import { describe, expect, it, vi } from "vitest";
import type { SetupStatus } from "../../schemas/config/index.js";
import {
  deriveDiagnosticsActions,
  getContextActionLabel,
  getContextPresentation,
  getServerStatusPresentation,
  getSetupPresentation,
  refreshAllDiagnostics,
} from "./diagnostics.js";

function makeSetup(overrides: Partial<SetupStatus> = {}): SetupStatus {
  return {
    hasSecretsStorage: true,
    hasProvider: true,
    hasModel: true,
    hasTrust: true,
    isConfigured: true,
    isReady: true,
    missing: [],
    ...overrides,
  };
}

describe("getServerStatusPresentation", () => {
  it("uses Title Case canonical labels and variants", () => {
    expect(getServerStatusPresentation({ status: "checking" })).toEqual({
      label: "Checking...",
      variant: "info",
    });
    expect(getServerStatusPresentation({ status: "connected" })).toEqual({
      label: "Connected",
      variant: "success",
    });
    expect(getServerStatusPresentation({ status: "error", message: "boom" })).toEqual({
      label: "Error: boom",
      variant: "error",
    });
  });
});

describe("getSetupPresentation", () => {
  it("handles the loading and error branches", () => {
    expect(getSetupPresentation({ isLoading: true, error: null, setupStatus: null })).toEqual({
      label: "Loading...",
      variant: "info",
    });
    expect(getSetupPresentation({ isLoading: false, error: "fail", setupStatus: null })).toEqual({
      label: "Error: fail",
      variant: "error",
    });
  });

  it("reports Ready and Incomplete in Title Case", () => {
    expect(
      getSetupPresentation({ isLoading: false, error: null, setupStatus: makeSetup() }),
    ).toEqual({ label: "Ready", variant: "success" });
    expect(
      getSetupPresentation({
        isLoading: false,
        error: null,
        setupStatus: makeSetup({ isReady: false, missing: ["provider"] }),
      }),
    ).toEqual({ label: "Incomplete (provider)", variant: "warning" });
    expect(getSetupPresentation({ isLoading: false, error: null, setupStatus: null })).toEqual({
      label: "Unavailable",
      variant: "warning",
    });
  });
});

describe("getContextPresentation", () => {
  it("maps each context status to a Title Case label and variant", () => {
    expect(getContextPresentation("loading", null)).toEqual({
      label: "Loading...",
      variant: "info",
    });
    expect(getContextPresentation("ready", null)).toEqual({ label: "Ready", variant: "success" });
    expect(getContextPresentation("missing", null)).toEqual({
      label: "Missing",
      variant: "warning",
    });
    expect(getContextPresentation("error", "boom")).toEqual({
      label: "Error: boom",
      variant: "error",
    });
    expect(getContextPresentation("error", null)).toEqual({
      label: "Error: unknown",
      variant: "error",
    });
  });
});

describe("getContextActionLabel", () => {
  it("uses Regenerating... as the canonical busy label", () => {
    expect(getContextActionLabel(true, "ready")).toBe("Regenerating...");
    expect(getContextActionLabel(false, "ready")).toBe("Regenerate Context");
    expect(getContextActionLabel(false, "missing")).toBe("Generate Context");
  });
});

describe("deriveDiagnosticsActions", () => {
  it("includes isRefreshingAll in both disabled clauses", () => {
    expect(
      deriveDiagnosticsActions({ canRegenerate: true, isRefreshing: false, isRefreshingAll: true }),
    ).toEqual({ refreshAllDisabled: true, contextActionDisabled: true });
    expect(
      deriveDiagnosticsActions({ canRegenerate: true, isRefreshing: true, isRefreshingAll: false }),
    ).toEqual({ refreshAllDisabled: true, contextActionDisabled: true });
    expect(
      deriveDiagnosticsActions({
        canRegenerate: false,
        isRefreshing: false,
        isRefreshingAll: false,
      }),
    ).toEqual({ refreshAllDisabled: false, contextActionDisabled: true });
    expect(
      deriveDiagnosticsActions({
        canRegenerate: true,
        isRefreshing: false,
        isRefreshingAll: false,
      }),
    ).toEqual({ refreshAllDisabled: false, contextActionDisabled: false });
  });
});

describe("refreshAllDiagnostics", () => {
  it("settles both refreshes regardless of individual failure", async () => {
    const retryServer = vi.fn().mockResolvedValue("ok");
    const refetchContext = vi.fn().mockRejectedValue(new Error("nope"));
    const results = await refreshAllDiagnostics({ retryServer, refetchContext });
    expect(retryServer).toHaveBeenCalledOnce();
    expect(refetchContext).toHaveBeenCalledOnce();
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  });
});
