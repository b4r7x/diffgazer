import { describe, expect, it } from "vitest";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_GLOBAL, SHUTDOWN_TOKEN_HEADER } from "./protocol.js";

describe("protocol constants", () => {
  it("pins the cross-package runtime contract values", () => {
    expect(PROJECT_ROOT_HEADER).toBe("x-diffgazer-project-root");
    expect(SHUTDOWN_TOKEN_HEADER).toBe("x-diffgazer-shutdown-token");
    expect(SHUTDOWN_TOKEN_GLOBAL).toBe("__DIFFGAZER_SHUTDOWN_TOKEN__");
  });
});
