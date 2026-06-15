import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { warnUnregisteredValue } from "./warn-unregistered-value";

describe("warnUnregisteredValue", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it("warns when the value is not in the registered set", () => {
    warnUnregisteredValue("RadioGroup", "ghost", ["a", "b"]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("ghost");
    expect(warn.mock.calls[0]?.[0]).toContain("RadioGroup");
  });

  it("stays silent for a registered value", () => {
    warnUnregisteredValue("RadioGroup", "a", ["a", "b"]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("is a no-op in production", () => {
    process.env.NODE_ENV = "production";
    warnUnregisteredValue("RadioGroup", "ghost", ["a", "b"]);
    expect(warn).not.toHaveBeenCalled();
  });
});
