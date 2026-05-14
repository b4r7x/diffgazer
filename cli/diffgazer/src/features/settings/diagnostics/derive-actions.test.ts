import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  deriveDiagnosticsActions,
  triggerDiagnosticsRefreshAll,
} from "./derive-actions.js";

describe("deriveDiagnosticsActions", () => {
  test("shows 'Generate Context' when no snapshot exists", () => {
    const result = deriveDiagnosticsActions({
      canRegenerate: true,
      isRefreshing: false,
      contextStatus: "missing",
    });
    assert.equal(result.contextActionLabel, "Generate Context");
    assert.equal(result.contextActionDisabled, false);
  });

  test("shows 'Regenerate Context' when a snapshot is ready", () => {
    const result = deriveDiagnosticsActions({
      canRegenerate: true,
      isRefreshing: false,
      contextStatus: "ready",
    });
    assert.equal(result.contextActionLabel, "Regenerate Context");
    assert.equal(result.contextActionDisabled, false);
  });

  test("disables and shows 'Regenerating...' while refreshing", () => {
    const result = deriveDiagnosticsActions({
      canRegenerate: true,
      isRefreshing: true,
      contextStatus: "ready",
    });
    assert.equal(result.contextActionLabel, "Regenerating...");
    assert.equal(result.contextActionDisabled, true);
  });

  test("disables action when canRegenerate is false", () => {
    const result = deriveDiagnosticsActions({
      canRegenerate: false,
      isRefreshing: false,
      contextStatus: "missing",
    });
    assert.equal(result.contextActionDisabled, true);
  });

  test("treats loading and error context status as 'no snapshot yet' (Generate)", () => {
    for (const contextStatus of ["loading", "error"] as const) {
      const result = deriveDiagnosticsActions({
        canRegenerate: true,
        isRefreshing: false,
        contextStatus,
      });
      assert.equal(result.contextActionLabel, "Generate Context");
    }
  });

  test("Regenerating label takes precedence over the snapshot status", () => {
    const ready = deriveDiagnosticsActions({
      canRegenerate: true,
      isRefreshing: true,
      contextStatus: "ready",
    });
    const missing = deriveDiagnosticsActions({
      canRegenerate: true,
      isRefreshing: true,
      contextStatus: "missing",
    });
    assert.equal(ready.contextActionLabel, "Regenerating...");
    assert.equal(missing.contextActionLabel, "Regenerating...");
  });
});

describe("triggerDiagnosticsRefreshAll", () => {
  test("invokes both retryServer and refetchContext", async () => {
    let retried = false;
    let refetched = false;
    await triggerDiagnosticsRefreshAll({
      retryServer: async () => {
        retried = true;
      },
      refetchContext: async () => {
        refetched = true;
      },
    });
    assert.equal(retried, true);
    assert.equal(refetched, true);
  });

  test("settles even when one of the calls rejects", async () => {
    const results = await triggerDiagnosticsRefreshAll({
      retryServer: async () => {
        throw new Error("server down");
      },
      refetchContext: async () => "ok",
    });
    assert.equal(results.length, 2);
    assert.equal(results[0]?.status, "rejected");
    assert.equal(results[1]?.status, "fulfilled");
  });
});
