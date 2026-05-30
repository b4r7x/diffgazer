import { test, describe, expect } from "vitest";
import type { SetupStatus } from "@diffgazer/core/schemas/config";
import {
  getServerBadgeVariant,
  getServerLabel,
  getSetupLabel,
  getSetupVariant,
  getContextLabel,
  getContextVariant,
} from "./derive-display";

const SETUP_STATUS_READY: SetupStatus = {
  hasSecretsStorage: true,
  hasProvider: true,
  hasModel: true,
  hasTrust: true,
  isConfigured: true,
  isReady: true,
  missing: [],
};

const SETUP_STATUS_MISSING_PROVIDER: SetupStatus = {
  hasSecretsStorage: true,
  hasProvider: false,
  hasModel: false,
  hasTrust: true,
  isConfigured: false,
  isReady: false,
  missing: ["provider", "model"],
};

describe("getServerBadgeVariant", () => {
  test.each([
    { status: "connected" as const, variant: "success" },
    { status: "checking" as const, variant: "info" },
    { status: "error" as const, variant: "error" },
  ])("maps server status '$status' to badge variant '$variant'", ({ status, variant }) => {
    expect(getServerBadgeVariant(status)).toBe(variant);
  });
});

describe("getServerLabel", () => {
  test("returns checking label while checking", () => {
    expect(getServerLabel("checking", null)).toBe("checking...");
  });
  test("returns connected label when connected", () => {
    expect(getServerLabel("connected", null)).toBe("connected");
  });
  test("includes error message when in error state", () => {
    expect(getServerLabel("error", "boom")).toBe("error: boom");
  });
  test("falls back to unknown when error message is missing", () => {
    expect(getServerLabel("error", null)).toBe("error: unknown");
  });
});

describe("getSetupLabel", () => {
  test("returns loading label while loading", () => {
    expect(
      getSetupLabel({ isLoading: true, error: null, setupStatus: null }),
    ).toBe("loading...");
  });
  test("returns error label when initError is set", () => {
    expect(
      getSetupLabel({ isLoading: false, error: "fail", setupStatus: null }),
    ).toBe("error: fail");
  });
  test("returns ready when setupStatus is ready", () => {
    expect(
      getSetupLabel({ isLoading: false, error: null, setupStatus: SETUP_STATUS_READY }),
    ).toBe("ready");
  });
  test("lists missing fields when not ready", () => {
    expect(
      getSetupLabel({ isLoading: false, error: null, setupStatus: SETUP_STATUS_MISSING_PROVIDER }),
    ).toBe("incomplete (provider, model)");
  });
  test("falls back to unknown when setupStatus is null and not loading/error", () => {
    expect(
      getSetupLabel({ isLoading: false, error: null, setupStatus: null }),
    ).toBe("incomplete (unknown)");
  });
});

describe("getSetupVariant", () => {
  test("loading -> info", () => {
    expect(
      getSetupVariant({ isLoading: true, error: null, setupStatus: null }),
    ).toBe("info");
  });
  test("error -> error", () => {
    expect(
      getSetupVariant({ isLoading: false, error: "x", setupStatus: null }),
    ).toBe("error");
  });
  test("ready -> success", () => {
    expect(
      getSetupVariant({ isLoading: false, error: null, setupStatus: SETUP_STATUS_READY }),
    ).toBe("success");
  });
  test("incomplete -> warning", () => {
    expect(
      getSetupVariant({
        isLoading: false,
        error: null,
        setupStatus: SETUP_STATUS_MISSING_PROVIDER,
      }),
    ).toBe("warning");
  });
});

describe("getContextLabel", () => {
  test("loading", () => expect(getContextLabel("loading", null)).toBe("loading..."));
  test("ready", () => expect(getContextLabel("ready", null)).toBe("ready"));
  test("missing", () => expect(getContextLabel("missing", null)).toBe("missing"));
  test("error with message", () =>
    expect(getContextLabel("error", "boom")).toBe("error: boom"));
  test("error without message", () =>
    expect(getContextLabel("error", null)).toBe("error: unknown"));
});

describe("getContextVariant", () => {
  test.each([
    { status: "ready" as const, variant: "success" },
    { status: "missing" as const, variant: "warning" },
    { status: "loading" as const, variant: "info" },
    { status: "error" as const, variant: "error" },
  ])("maps context status '$status' to variant '$variant'", ({ status, variant }) => {
    expect(getContextVariant(status)).toBe(variant);
  });
});
