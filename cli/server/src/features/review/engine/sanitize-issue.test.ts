import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it } from "vitest";
import { sanitizeIssue } from "./sanitize-issue.js";

const ESC = "\u001b";
const OSC52 = `${ESC}]52;c;payload\u0007`;

describe("sanitizeIssue", () => {
  it("strips OSC and CSI escape sequences from file, evidence, and trace fields", () => {
    const issue = makeIssue({
      id: "issue",
      file: `src/app.ts${OSC52}`,
      title: `title${OSC52}`,
      rationale: `rationale${OSC52}`,
      recommendation: `recommendation${OSC52}`,
      symptom: `symptom${OSC52}`,
      whyItMatters: `whyItMatters${OSC52}`,
      suggested_patch: `patch${OSC52}`,
      betterOptions: [`option-1${OSC52}`, `option-2${OSC52}`],
      testsToAdd: [`test-1${OSC52}`, `test-2${OSC52}`],
      evidence: [
        {
          type: "code",
          title: `evidence${OSC52}`,
          sourceId: `source${OSC52}`,
          file: `src/evidence.ts${OSC52}`,
          excerpt: `excerpt${OSC52}`,
          sha: `abc123${OSC52}`,
        },
      ],
      fixPlan: [
        {
          step: 1,
          action: `action${OSC52}`,
          files: [`src/fix.ts${OSC52}`],
        },
      ],
      trace: [
        {
          step: 1,
          tool: `tool${OSC52}`,
          inputSummary: `input${OSC52}`,
          outputSummary: `output${OSC52}`,
          timestamp: `time${OSC52}`,
          artifacts: [`artifact${OSC52}`],
        },
      ],
    });

    const result = sanitizeIssue(issue);

    expect(JSON.stringify(result)).not.toContain(ESC);
    expect(result).toMatchObject({
      id: "issue",
      file: "src/app.ts",
      title: "title",
      rationale: "rationale",
      recommendation: "recommendation",
      symptom: "symptom",
      whyItMatters: "whyItMatters",
      suggested_patch: "patch",
      betterOptions: ["option-1", "option-2"],
      testsToAdd: ["test-1", "test-2"],
      evidence: [{ title: "evidence", sourceId: "source", file: "src/evidence.ts", sha: "abc123" }],
      fixPlan: [{ action: "action", files: ["src/fix.ts"] }],
      trace: [
        {
          tool: "tool",
          inputSummary: "input",
          outputSummary: "output",
          timestamp: "time",
          artifacts: ["artifact"],
        },
      ],
    });
  });

  it("preserves distinct raw issue ids that would collapse under sanitization", () => {
    const rawA = `issue${OSC52}`;
    const rawB = `issue${ESC}]52;c;other`;

    const a = sanitizeIssue(makeIssue({ id: rawA }));
    const b = sanitizeIssue(makeIssue({ id: rawB }));

    expect(a.id).toBe(rawA);
    expect(b.id).toBe(rawB);
    expect(a.id).not.toBe(b.id);
  });

  it("preserves text after 7-bit and C1 OSC sequences terminated by C1 ST", () => {
    const result = sanitizeIssue(
      makeIssue({
        title: `before\x1b]0;title\x9cafter`,
        rationale: `left\x9d52;c;payload\x9cright`,
      }),
    );

    expect(result.title).toBe("beforeafter");
    expect(result.rationale).toBe("leftright");
  });
});
