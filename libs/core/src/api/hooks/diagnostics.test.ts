import { describe, expect, it, vi } from "vitest";
import { refreshAllDiagnostics } from "./diagnostics.js";

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
