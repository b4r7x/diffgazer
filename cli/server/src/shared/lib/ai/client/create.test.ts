import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadCreate,
  setupClientTestHome,
  teardownClientTestHome,
} from "../../testing/ai-client-env.js";
import { clientTestAdmittedPlan } from "../../testing/ai-client-fixtures.js";

describe("createFromAdmittedPlan", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("binds exact provider and model identity from the admitted plan", async () => {
    const { createFromAdmittedPlan } = await loadCreate();
    const plan = clientTestAdmittedPlan("gemini", { modelId: "gemini-explicit-model" });
    const result = createFromAdmittedPlan(plan);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productId).toBe("gemini");
    expect(result.value.modelId).toBe("gemini-explicit-model");
    expect(result.value.transportFamily).toBe("hosted-api");
    expect(result.value.configurationId).toBe(plan.configurationId);
    expect(result.value.executionFingerprint).toBe(plan.executionFingerprint);
  });

  it("settles a non-completed execution with zero findings when no server channel supplies a credential", async () => {
    const { createFromAdmittedPlan } = await loadCreate();
    const clientResult = createFromAdmittedPlan(clientTestAdmittedPlan("gemini"));
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const execution = await clientResult.value.execute("review this diff");
    expect(execution.receipt.outcome).not.toBe("completed");
    expect(execution.result.issues).toEqual([]);
  });
});
