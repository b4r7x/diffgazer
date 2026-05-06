import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { applyIntegrationDeps, DEFAULT_KEYS_VERSION_SPEC, resolveIntegrations } from "./add-integration.js";

describe("applyIntegrationDeps", () => {
  test("removes keys dep in copy mode", () => {
    const deps = ["react", "@diffgazer/keys"];
    const result = applyIntegrationDeps(deps, { mode: "copy", hasKeyboardIntegration: true }, "latest");
    assert.ok(!result.includes("@diffgazer/keys"));
    assert.ok(result.includes("react"));
  });

  test("adds keys dep in package mode with keyboard integration", () => {
    const deps = ["react"];
    const result = applyIntegrationDeps(
      deps,
      { mode: "@diffgazer/keys", hasKeyboardIntegration: true },
      DEFAULT_KEYS_VERSION_SPEC,
    );
    assert.ok(result.includes(`@diffgazer/keys@${DEFAULT_KEYS_VERSION_SPEC}`));
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

describe("resolveIntegrations", () => {
  test("uses copy mode when prompts are skipped for components with keyboard hooks", async () => {
    const result = await resolveIntegrations(["checkbox"], "ask", true);

    assert.deepEqual(result, { mode: "copy", hasKeyboardIntegration: true });
  });

  test("detects keyboard integration from keys registry dependencies", async () => {
    const result = await resolveIntegrations(["accordion"], "@diffgazer/keys", true);

    assert.deepEqual(result, { mode: "@diffgazer/keys", hasKeyboardIntegration: true });
  });

  test("rejects none mode for components with required keyboard hook imports", async () => {
    await assert.rejects(
      () => resolveIntegrations(["radio"], "none", false),
      /require keyboard hooks/,
    );
  });

  test("allows none mode when selected components do not use keyboard hooks", async () => {
    const result = await resolveIntegrations(["button"], "none", true);

    assert.deepEqual(result, { mode: "none", hasKeyboardIntegration: false });
  });
});
