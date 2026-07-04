import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it } from "vitest";
import { sanitizeIssue } from "./sanitize-issue.js";

const ESC = "\u001b";
const OSC52 = `${ESC}]52;c;payload\u0007`;

describe("sanitizeIssue", () => {
  it("strips OSC and CSI escape sequences from file, id, evidence, and trace fields", () => {
    const issue = makeIssue({
      id: `issue${OSC52}`,
      file: `src/app.ts${OSC52}`,
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
});
