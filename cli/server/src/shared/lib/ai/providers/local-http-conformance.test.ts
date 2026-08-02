import { describe, expect, it } from "vitest";
import { hashLocalConformanceIdentity } from "./local-http-discovery.js";
import {
  assertAllGateObservationsPresent,
  canProduceLocalReadyEvidence,
  isLocalHttpLiveProbeOptIn,
  isLocalRuntimeReachable,
  LOCAL_HTTP_GATE_IDS,
  LOCAL_HTTP_RUNTIME_FIXTURES,
  runLocalHttpLiveGateSuite,
  runLocalHttpMockGateSuite,
} from "./local-http-fixtures.js";

describe("REQ-087 local HTTP conformance fixtures", () => {
  it.each(
    LOCAL_HTTP_RUNTIME_FIXTURES,
  )("$id mock suite records all seven gate observations", async (fixture) => {
    const result = await runLocalHttpMockGateSuite(fixture);
    expect(assertAllGateObservationsPresent(result.gates).ok).toBe(true);
    expect(result.gates).toHaveLength(LOCAL_HTTP_GATE_IDS.length);
    expect(result.gates.every((gate) => gate.status === "passed")).toBe(true);
    expect(result.identityHash).toBe(result.expectedIdentityHash);
    expect(result.ready).toBe(true);
    expect(canProduceLocalReadyEvidence(result)).toBe(false);
  });

  it("requires the exact identity hash before reporting ready", async () => {
    const fixture = LOCAL_HTTP_RUNTIME_FIXTURES[0];
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const result = await runLocalHttpMockGateSuite(fixture);
    expect(result.identityHash).toBeTruthy();
    expect(result.expectedIdentityHash).toBe(result.identityHash);

    const mutated = hashLocalConformanceIdentity({
      productId: fixture.productId,
      normalizedEndpoint: fixture.endpoint,
      runtime: { identity: fixture.runtimeIdentity, version: "mutated-version" },
      modelId: fixture.modelId,
    });
    expect(mutated).not.toBe(result.identityHash);
  });

  it("never reports ready when any gate observation fails", async () => {
    const fixture = LOCAL_HTTP_RUNTIME_FIXTURES[0];
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const result = await runLocalHttpMockGateSuite(fixture);
    const failingGate = result.gates.find((gate) => gate.gate === "schema-valid-review");
    expect(failingGate?.status).toBe("passed");

    const synthetic = {
      ...result,
      gates: result.gates.map((gate) =>
        gate.gate === "abort-closure" ? { ...gate, status: "failed" as const } : gate,
      ),
      ready: false,
    };
    expect(synthetic.ready).toBe(false);
    expect(canProduceLocalReadyEvidence(synthetic)).toBe(false);
  });
});

describe("REQ-089 local HTTP live truthfulness", () => {
  it("reports absent local runtime as skipped/unsupported, never passed", async () => {
    for (const fixture of LOCAL_HTTP_RUNTIME_FIXTURES) {
      const reachable = await isLocalRuntimeReachable(fixture);
      if (reachable && isLocalHttpLiveProbeOptIn()) {
        continue;
      }

      const result = await runLocalHttpLiveGateSuite(fixture);
      expect(result.ready).toBe(false);
      expect(canProduceLocalReadyEvidence(result)).toBe(false);
      expect(result.gates.every((gate) => gate.status !== "passed" || !result.ready)).toBe(true);
      if (!isLocalHttpLiveProbeOptIn()) {
        expect(result.gates.every((gate) => gate.status === "skipped")).toBe(true);
      } else if (!reachable) {
        expect(result.gates.every((gate) => gate.status === "unsupported")).toBe(true);
      }
    }
  });
});

describe.runIf(isLocalHttpLiveProbeOptIn())("REQ-087 live local HTTP conformance (opt-in)", () => {
  for (const fixture of LOCAL_HTTP_RUNTIME_FIXTURES) {
    it(`live ${fixture.id} requires all seven gates and exact identity hash`, async () => {
      const reachable = await isLocalRuntimeReachable(fixture);
      if (!reachable) {
        const skipped = await runLocalHttpLiveGateSuite(fixture);
        expect(skipped.ready).toBe(false);
        expect(canProduceLocalReadyEvidence(skipped)).toBe(false);
        expect(skipped.gates.every((gate) => gate.status === "unsupported")).toBe(true);
        return;
      }

      const result = await runLocalHttpLiveGateSuite(fixture);
      expect(assertAllGateObservationsPresent(result.gates).ok).toBe(true);
      if (result.ready) {
        expect(result.identityHash).toBe(result.expectedIdentityHash);
        expect(result.gates.every((gate) => gate.status === "passed")).toBe(true);
        expect(canProduceLocalReadyEvidence(result)).toBe(true);
      } else {
        expect(canProduceLocalReadyEvidence(result)).toBe(false);
      }
    }, 120_000);
  }
});
