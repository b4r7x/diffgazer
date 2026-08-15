import { describe, expect, it, vi } from "vitest";
import { refreshAllDiagnostics } from "./diagnostics.js";

describe("refreshAllDiagnostics", () => {
  it("settles every displayed diagnostic source regardless of individual failure", async () => {
    const retryServer = vi.fn().mockResolvedValue("ok");
    const refetchContext = vi.fn().mockRejectedValue(new Error("nope"));
    const refetchInit = vi.fn().mockResolvedValue("init");
    const results = await refreshAllDiagnostics({ retryServer, refetchContext, refetchInit });
    expect(retryServer).toHaveBeenCalledOnce();
    expect(refetchContext).toHaveBeenCalledOnce();
    expect(refetchInit).toHaveBeenCalledOnce();
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });
});
