import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { applyIntegrationDeps } from "./add-integration.js";

describe("applyIntegrationDeps", () => {
  test("removes keys dep in copy mode", () => {
    const deps = ["react", "@diffgazer/keys"];
    const result = applyIntegrationDeps(deps, { mode: "copy", hasKeyboardIntegration: true }, "latest");
    assert.ok(!result.includes("@diffgazer/keys"));
    assert.ok(result.includes("react"));
  });

  test("adds keys dep in package mode with keyboard integration", () => {
    const deps = ["react"];
    const result = applyIntegrationDeps(deps, { mode: "@diffgazer/keys", hasKeyboardIntegration: true }, "latest");
    assert.ok(result.includes("@diffgazer/keys"));
  });

  test("adds versioned keys dep when version is specified", () => {
    const deps = ["react"];
    const result = applyIntegrationDeps(deps, { mode: "@diffgazer/keys", hasKeyboardIntegration: true }, "1.2.3");
    assert.ok(result.includes("@diffgazer/keys@1.2.3"));
  });

  test("returns deps unchanged in none mode", () => {
    const deps = ["react", "clsx"];
    const result = applyIntegrationDeps(deps, { mode: "none", hasKeyboardIntegration: false }, "latest");
    assert.deepEqual(result.sort(), ["clsx", "react"]);
  });

  test("removes existing versioned keys deps", () => {
    const deps = ["react", "/keys@0.9.0", "@diffgazer/keys@0.9.0"];
    const result = applyIntegrationDeps(deps, { mode: "@diffgazer/keys", hasKeyboardIntegration: true }, "1.0.0");
    assert.ok(!result.includes("/keys@0.9.0"));
    assert.ok(!result.includes("@diffgazer/keys@0.9.0"));
    assert.ok(result.includes("@diffgazer/keys@1.0.0"));
  });
});
