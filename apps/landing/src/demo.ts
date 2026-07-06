export type FindingSeverity = "blocker" | "high" | "medium" | "low" | "nit";

export interface DemoFinding {
  severity: FindingSeverity;
  tag: string;
  title: string;
  location: string;
  body: string;
  fix: [kind: "add" | "rem", line: string][];
}

export const demoFindings = [
  {
    title: "API token written to log output",
    severity: "blocker",
    tag: "security",
    location: "logger.ts:41",
    body: "logger.ts:41 interpolates the raw Authorization header into the request log. Any log sink now stores live credentials.",
    fix: [
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal source excerpt of the logged bug, not a template.
      ["rem", "- log.info(`auth ${req.headers.authorization}`)"],
      ["add", '+ log.info("auth header present")'],
    ],
  },
  {
    title: "calculateScore ignores severity weights",
    severity: "high",
    tag: "correctness",
    location: "score.ts:4",
    body: "Every finding counts the same 10 points, so one nit and one blocker move the score equally.",
    fix: [
      ["rem", "- return review.findings.length * 10"],
      ["add", "+ return review.findings.reduce(...)"],
    ],
  },
  {
    title: "findings re-sorted on every render",
    severity: "medium",
    tag: "performance",
    location: "report.tsx:88",
    body: "report.tsx:88 sorts inside the component body. Every keystroke re-sorts the full list.",
    fix: [["add", "+ const sorted = useMemo(() => sort(findings), [findings])"]],
  },
  {
    title: "retry logic duplicated across clients",
    severity: "low",
    tag: "simplicity",
    location: "http.ts:12",
    body: "http.ts:12 and stream.ts:30 carry the same backoff loop with different jitter.",
    fix: [["add", '+ import { withRetry } from "./retry"']],
  },
  {
    title: "missing test case: empty diff",
    severity: "nit",
    tag: "tests",
    location: "score.test.ts:5",
    body: "score.test.ts never covers an empty diff - the default state of a clean tree.",
    fix: [["add", "+ expect(calculateScore(emptyReview, weights)).toBe(0)"]],
  },
] satisfies [DemoFinding, ...DemoFinding[]];

export const pipelineFindings = demoFindings.slice(0, 3);

const firstFinding = demoFindings[0];

function findDemoFinding(tag: DemoFinding["tag"]): DemoFinding {
  return demoFindings.find((finding) => finding.tag === tag) ?? firstFinding;
}

export const gazeFindings = [findDemoFinding("correctness"), findDemoFinding("tests")] satisfies [
  DemoFinding,
  DemoFinding,
];

export function formatFindingSummary(findings: readonly DemoFinding[]): string {
  const blockers = findings.filter((finding) => finding.severity === "blocker").length;
  const blockerLabel = blockers === 1 ? "blocker" : "blockers";
  return `${findings.length} findings · ${blockers} ${blockerLabel}`;
}
