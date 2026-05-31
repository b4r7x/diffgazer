import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "./log.js";

// The logger stays silent under VITEST by design. These tests exercise the
// real threshold logic, so they unset VITEST for the duration and restore the
// surrounding env afterwards.
describe("log default level", () => {
  let originalVitest: string | undefined;
  let originalLevel: string | undefined;
  let originalPackaged: string | undefined;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalVitest = process.env.VITEST;
    originalLevel = process.env.DIFFGAZER_LOG_LEVEL;
    originalPackaged = process.env.DIFFGAZER_PACKAGED;
    delete process.env.VITEST;
    delete process.env.DIFFGAZER_LOG_LEVEL;
    delete process.env.DIFFGAZER_PACKAGED;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalVitest === undefined) delete process.env.VITEST;
    else process.env.VITEST = originalVitest;
    if (originalLevel === undefined) delete process.env.DIFFGAZER_LOG_LEVEL;
    else process.env.DIFFGAZER_LOG_LEVEL = originalLevel;
    if (originalPackaged === undefined) delete process.env.DIFFGAZER_PACKAGED;
    else process.env.DIFFGAZER_PACKAGED = originalPackaged;
    vi.restoreAllMocks();
  });

  it("emits info request logs by default in standalone (non-packaged) mode", () => {
    log("info", "request", { path: "/api/health" });
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("suppresses info logs by default in packaged mode but keeps warnings", () => {
    process.env.DIFFGAZER_PACKAGED = "1";

    log("info", "request", { path: "/api/health" });
    expect(logSpy).not.toHaveBeenCalled();

    log("warn", "slow_request", { path: "/api/review" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("honors an explicit DIFFGAZER_LOG_LEVEL=info even in packaged mode", () => {
    process.env.DIFFGAZER_PACKAGED = "1";
    process.env.DIFFGAZER_LOG_LEVEL = "info";

    log("info", "request", { path: "/api/health" });
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
