import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { SetupStatus } from "@diffgazer/core/schemas/config";
import {
  getServerBadgeVariant,
  getServerLabel,
  getSetupLabel,
  getSetupVariant,
  getContextLabel,
  getContextVariant,
} from "./derive-display.js";

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
  test("maps each server status to its badge variant", () => {
    assert.equal(getServerBadgeVariant("connected"), "success");
    assert.equal(getServerBadgeVariant("checking"), "info");
    assert.equal(getServerBadgeVariant("error"), "error");
  });
});

describe("getServerLabel", () => {
  test("returns checking label while checking", () => {
    assert.equal(getServerLabel("checking", null), "checking...");
  });
  test("returns connected label when connected", () => {
    assert.equal(getServerLabel("connected", null), "connected");
  });
  test("includes error message when in error state", () => {
    assert.equal(getServerLabel("error", "boom"), "error: boom");
  });
  test("falls back to unknown when error message is missing", () => {
    assert.equal(getServerLabel("error", null), "error: unknown");
  });
});

describe("getSetupLabel", () => {
  test("returns loading label while loading", () => {
    assert.equal(
      getSetupLabel({ isLoading: true, error: null, setupStatus: null }),
      "loading...",
    );
  });
  test("returns error label when initError is set", () => {
    assert.equal(
      getSetupLabel({ isLoading: false, error: "fail", setupStatus: null }),
      "error: fail",
    );
  });
  test("returns ready when setupStatus is ready", () => {
    assert.equal(
      getSetupLabel({ isLoading: false, error: null, setupStatus: SETUP_STATUS_READY }),
      "ready",
    );
  });
  test("lists missing fields when not ready", () => {
    assert.equal(
      getSetupLabel({ isLoading: false, error: null, setupStatus: SETUP_STATUS_MISSING_PROVIDER }),
      "incomplete (provider, model)",
    );
  });
  test("falls back to unknown when setupStatus is null and not loading/error", () => {
    assert.equal(
      getSetupLabel({ isLoading: false, error: null, setupStatus: null }),
      "incomplete (unknown)",
    );
  });
});

describe("getSetupVariant", () => {
  test("loading -> info", () => {
    assert.equal(
      getSetupVariant({ isLoading: true, error: null, setupStatus: null }),
      "info",
    );
  });
  test("error -> error", () => {
    assert.equal(
      getSetupVariant({ isLoading: false, error: "x", setupStatus: null }),
      "error",
    );
  });
  test("ready -> success", () => {
    assert.equal(
      getSetupVariant({ isLoading: false, error: null, setupStatus: SETUP_STATUS_READY }),
      "success",
    );
  });
  test("incomplete -> warning", () => {
    assert.equal(
      getSetupVariant({
        isLoading: false,
        error: null,
        setupStatus: SETUP_STATUS_MISSING_PROVIDER,
      }),
      "warning",
    );
  });
});

describe("getContextLabel", () => {
  test("loading", () => assert.equal(getContextLabel("loading", null), "loading..."));
  test("ready", () => assert.equal(getContextLabel("ready", null), "ready"));
  test("missing", () => assert.equal(getContextLabel("missing", null), "missing"));
  test("error with message", () =>
    assert.equal(getContextLabel("error", "boom"), "error: boom"));
  test("error without message", () =>
    assert.equal(getContextLabel("error", null), "error: unknown"));
});

describe("getContextVariant", () => {
  test("maps each context status to its variant", () => {
    assert.equal(getContextVariant("ready"), "success");
    assert.equal(getContextVariant("missing"), "warning");
    assert.equal(getContextVariant("loading"), "info");
    assert.equal(getContextVariant("error"), "error");
  });
});
