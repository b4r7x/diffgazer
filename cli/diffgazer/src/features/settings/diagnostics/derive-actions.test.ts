import { describe, expect, test } from "vitest";
import {
  deriveDiagnosticsActions,
  triggerDiagnosticsRefreshAll,
} from "./derive-actions";

describe("deriveDiagnosticsActions", () => {
  test("shows 'Generate Context' when no snapshot exists", () => {
    const result = deriveDiagnosticsActions({
      canRegenerate: true,
      isRefreshing: false,
      contextStatus: "missing",
    });
    expect(result.contextActionLabel).toBe("Generate Context");
    expect(result.contextActionDisabled).toBe(false);
  });

  test("shows 'Regenerate Context' when a snapshot is ready", () => {
    const result = deriveDiagnosticsActions({
      canRegenerate: true,
      isRefreshing: false,
      contextStatus: "ready",
    });
    expect(result.contextActionLabel).toBe("Regenerate Context");
    expect(result.contextActionDisabled).toBe(false);
  });

  test("disables and shows 'Regenerating...' while refreshing", () => {
    const result = deriveDiagnosticsActions({
      canRegenerate: true,
      isRefreshing: true,
      contextStatus: "ready",
    });
    expect(result.contextActionLabel).toBe("Regenerating...");
    expect(result.contextActionDisabled).toBe(true);
  });

  test("disables action when canRegenerate is false", () => {
    const result = deriveDiagnosticsActions({
      canRegenerate: false,
      isRefreshing: false,
      contextStatus: "missing",
    });
    expect(result.contextActionDisabled).toBe(true);
  });

  test("treats loading and error context status as 'no snapshot yet' (Generate)", () => {
    for (const contextStatus of ["loading", "error"] as const) {
      const result = deriveDiagnosticsActions({
        canRegenerate: true,
        isRefreshing: false,
        contextStatus,
      });
      expect(result.contextActionLabel).toBe("Generate Context");
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
    expect(ready.contextActionLabel).toBe("Regenerating...");
    expect(missing.contextActionLabel).toBe("Regenerating...");
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
    expect(retried).toBe(true);
    expect(refetched).toBe(true);
  });

  test("settles even when one of the calls rejects", async () => {
    const results = await triggerDiagnosticsRefreshAll({
      retryServer: async () => {
        throw new Error("server down");
      },
      refetchContext: async () => "ok",
    });
    expect(results.length).toBe(2);
    expect(results[0]?.status).toBe("rejected");
    expect(results[1]?.status).toBe("fulfilled");
  });
});
