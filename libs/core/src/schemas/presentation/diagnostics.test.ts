import { describe, expect, it } from "vitest";
import type { DiagnosticsSetupGaps } from "../config/index.js";
import { READINESS_PRESENTATION } from "../config/readiness.js";
import {
  deriveDiagnosticsActions,
  getContextActionLabel,
  getContextPresentation,
  getServerStatusPresentation,
  getSetupPresentation,
} from "./diagnostics.js";

function makeSetup(overrides: Partial<DiagnosticsSetupGaps> = {}): DiagnosticsSetupGaps {
  return {
    isConfigured: true,
    isReady: true,
    missing: [],
    readiness: null,
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

  it("renders readiness explanations instead of Incomplete (unknown)", () => {
    expect(
      getSetupPresentation({
        isLoading: false,
        error: null,
        setupStatus: makeSetup({
          isReady: false,
          missing: [],
          readiness: {
            status: "credential-invalid",
            ready: false,
            evidenceStatus: "failed",
            checkedAt: "2026-07-31T10:00:00.000Z",
            acknowledgement: { status: "not-applicable" },
            ...READINESS_PRESENTATION["credential-invalid"],
          },
        }),
      }),
    ).toEqual({
      label: READINESS_PRESENTATION["credential-invalid"].explanation,
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
