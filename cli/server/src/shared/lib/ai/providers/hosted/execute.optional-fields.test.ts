import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it, vi } from "vitest";
import { MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE } from "../../diagnostics.js";
import { executeHostedReview } from "./execute.js";
import {
  executeRequest,
  hostedContext,
  mockFetchResponse,
  openAiSuccessBody,
  requestBodyAt,
} from "./execute.test-support.js";

const CODE_EVIDENCE = {
  type: "code",
  title: "subtraction in add",
  sourceId: "file-1:2",
  excerpt: "  return a - b;",
} as const;

const wholeIssue = makeIssue({
  title: "add() subtracts its second argument",
  file: "file-1",
  line_start: 2,
  line_end: 2,
  suggested_patch:
    "--- a/src/add.ts\n+++ b/src/add.ts\n@@ -1,3 +1,3 @@\n export function add(a: number, b: number) {\n-  return a - b;\n+  return a + b;\n }\n",
  evidence: [{ ...CODE_EVIDENCE, file: "file-1", range: { start: 2, end: 2 }, sha: "abc" }],
});

// The live failure shape: a finding that is whole except for the item shape of
// the optional testsToAdd list (invalid-paths issues.0.testsToAdd.0..3).
const OBJECT_SHAPED_TESTS = [
  { name: "adds two positives", description: "expect(add(2, 3)).toBe(5)" },
  { name: "adds negatives", description: "expect(add(-2, -3)).toBe(-5)" },
  { name: "adds zero", description: "expect(add(0, 5)).toBe(5)" },
  { name: "adds floats", description: "expect(add(0.1, 0.2)).toBeCloseTo(0.3)" },
];

const objectShapedAnswer = { issues: [{ ...wholeIssue, testsToAdd: OBJECT_SHAPED_TESTS }] };

// The strict wire projection declares every optional field nullable AND
// required, so a route that conforms to it answers null where it has nothing.
const nullOptionalsAnswer = {
  issues: [
    {
      ...wholeIssue,
      fixPlan: [{ step: 1, action: "flip the operator", files: null, risk: null }],
      betterOptions: null,
      testsToAdd: null,
      trace: null,
      evidence: [{ ...CODE_EVIDENCE, file: null, range: null, sha: null }],
    },
  ],
};

// A JSON-mode route sees only the prompt's "null if a correct diff is
// impractical", and one with no patch can omit the key instead of nulling it.
const { suggested_patch: _omitted, ...patchlessIssue } = wholeIssue;
const suggestedPatchOmittedAnswer = { issues: [patchlessIssue] };

const unusableAnswer = {
  issues: [
    { ...wholeIssue, severity: "urgent", evidence: "none", testsToAdd: OBJECT_SHAPED_TESTS },
  ],
};

// A ref without its required excerpt: the server drops such a ref by its own
// completeness rule and keeps the finding, so the provider read must not void
// the whole answer over one ref's missing text.
const EXTERNAL_REF = { type: "external", title: "RFC 7231", sourceId: "rfc:7231" } as const;

const externalRefNoExcerptAnswer = {
  issues: [{ ...wholeIssue, evidence: [...wholeIssue.evidence, EXTERNAL_REF] }],
};

// The same body on every call, which is what the live models did: the
// corrective retry, where the profile grants one, returned the same answer.
async function dispatch(productId: HostedApiProductId, answer: unknown) {
  const fetch = mockFetchResponse(openAiSuccessBody(answer));
  const reportDiagnostic = vi.fn();
  const result = await executeHostedReview({
    ...executeRequest(productId),
    context: hostedContext(fetch),
    reportDiagnostic,
  });
  return { result, fetch, reportDiagnostic };
}

describe.each([
  { productId: "zai", responseFormat: "json_object", malformedOutputRetry: true },
  { productId: "openrouter", responseFormat: "json_schema", malformedOutputRetry: true },
  // No corrective retry on this profile: the lenient read carries the first answer alone.
  { productId: "moonshot", responseFormat: "json_schema", malformedOutputRetry: false },
] as const)("lenient provider reads at the execute seam — $productId ($responseFormat, malformedOutputRetry: $malformedOutputRetry)", ({
  productId,
  responseFormat,
  malformedOutputRetry,
}) => {
  it("completes with the whole finding and object-shaped testsToAdd entries coerced to strings, without spending a correction round", async () => {
    const { result, fetch, reportDiagnostic } = await dispatch(productId, objectShapedAnswer);

    // The wire differs per row; the local validation that decides the outcome does not.
    expect(requestBodyAt(fetch, 0).response_format).toMatchObject({ type: responseFormat });
    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toHaveLength(1);
    expect(result.result.issues[0]).toMatchObject({
      id: wholeIssue.id,
      suggested_patch: wholeIssue.suggested_patch,
      testsToAdd: OBJECT_SHAPED_TESTS.map((entry) => expect.stringContaining(entry.name)),
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it("completes when a strict route answers null for every optional field, reading each as omitted", async () => {
    const { result, fetch, reportDiagnostic } = await dispatch(productId, nullOptionalsAnswer);

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toStrictEqual([
      {
        ...wholeIssue,
        fixPlan: [{ step: 1, action: "flip the operator" }],
        evidence: [CODE_EVIDENCE],
      },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it("completes when the only finding omits suggested_patch, reading the absent key as null", async () => {
    const { result, fetch, reportDiagnostic } = await dispatch(
      productId,
      suggestedPatchOmittedAnswer,
    );

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toStrictEqual([{ ...wholeIssue, suggested_patch: null }]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it("completes when the only finding cites an external ref without an excerpt, reading the excerpt as blank", async () => {
    const { result, fetch, reportDiagnostic } = await dispatch(
      productId,
      externalRefNoExcerptAnswer,
    );

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toStrictEqual([
      { ...wholeIssue, evidence: [...wholeIssue.evidence, { ...EXTERNAL_REF, excerpt: "" }] },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it("still fails closed on an unusable core payload, naming only the required fields as invalid", async () => {
    const { result, fetch, reportDiagnostic } = await dispatch(productId, unusableAnswer);

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.result.issues).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(malformedOutputRetry ? 2 : 1);
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: malformedOutputRetry
          ? MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE
          : "malformed-review-output",
        truncatedDetails: expect.stringContaining(
          "invalid-paths: issues.0.severity, issues.0.evidence",
        ),
      }),
    );
  });
});
