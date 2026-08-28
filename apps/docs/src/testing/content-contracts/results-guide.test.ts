import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { CONFIGURE_PROVIDER_LABEL, TERMINAL_OUTCOME_PRESENTATION } from "@diffgazer/core/review";
import {
  LEGACY_V1_HAS_API_KEY_PROPERTY,
  READINESS_PRESENTATION,
  READINESS_STATUSES,
} from "@diffgazer/core/schemas/config";
import { TERMINAL_OUTCOMES, terminalOutcomeKeepsFindings } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";

const operationsRoot = resolve(import.meta.dirname, "../../../content/docs/app/operations");
const referenceRoot = resolve(import.meta.dirname, "../../../content/docs/app/reference");

const troubleshooting = readFileSync(resolve(operationsRoot, "troubleshooting.mdx"), "utf8");
const apiReference = readFileSync(resolve(referenceRoot, "api.mdx"), "utf8");

const REQ_101_SYMPTOMS = [
  {
    id: "invalid-credential",
    heading: "Invalid credential",
    readiness: "credential-invalid" as const,
  },
  {
    id: "wrong-product-or-endpoint",
    heading: "Wrong product or endpoint",
  },
  {
    id: "model-missing",
    heading: "Model missing",
    readiness: "model-missing" as const,
  },
  {
    id: "schema-failure",
    heading: "Schema failure",
    readiness: "conformance-failed" as const,
  },
  {
    id: "missing-usage",
    heading: "Missing usage",
    phrase: "Usage unavailable",
  },
  {
    id: "budget-exhaustion",
    heading: "Budget exhaustion",
    outcome: "budget-exhausted" as const,
  },
  {
    id: "unsupported-configuration",
    heading: "Unsupported configuration",
    readiness: "unsupported" as const,
  },
  {
    id: "cancellation",
    heading: "Cancellation",
    outcome: "cancelled" as const,
  },
  {
    id: "timeout",
    heading: "Timeout",
    outcome: "timed-out" as const,
  },
  {
    id: "skipped-live-probe",
    heading: "Intentionally skipped live probe",
    readiness: "skipped" as const,
  },
] as const;

/**
 * One pattern per forbidden subject. A single `\b(?:…)\b` alternation cannot
 * express this: a word boundary is unformable before `/` or `~`, which silently
 * disabled both path-leak alternatives. `positive` is the synthetic offender the
 * pattern must still match, so a pattern that stops working fails loudly.
 */
const FORBIDDEN_GUIDANCE_SUBJECTS = [
  {
    label: "legacy V1 credential flag",
    pattern: new RegExp(String.raw`\b${LEGACY_V1_HAS_API_KEY_PROPERTY}\b`, "i"),
    positive: `The response includes ${LEGACY_V1_HAS_API_KEY_PROPERTY}.`,
  },
  {
    label: "raw diagnostic guidance",
    pattern: /\braw diagnostic\b/i,
    positive: "Read the raw diagnostic emitted by the provider.",
  },
  {
    label: "bearer token literal",
    pattern: /\bBearer\s+[A-Za-z0-9+/=]{8,}/,
    positive: "Authorization: Bearer abcdefgh12345678",
  },
  {
    label: "API key literal",
    pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/,
    positive: "Set the key to sk-abcdefgh12345678.",
  },
  {
    label: "GitHub token literal",
    pattern: /\bghp_[A-Za-z0-9]+\b/,
    positive: "Set the token to ghp_abcdefgh12345678.",
  },
  {
    label: "absolute home path",
    pattern: /\/Users\//,
    positive: "Open `/Users/alex/project/config.json`.",
  },
  {
    label: "user config path",
    pattern: /~\/\.config\//,
    positive: "Open `~/.config/diffgazer/config.json`.",
  },
] as const;

function expectNoForbiddenGuidance(document: string, label: string): void {
  for (const subject of FORBIDDEN_GUIDANCE_SUBJECTS) {
    expect(subject.positive, `${subject.label} self-check`).toMatch(subject.pattern);
    expect(document, `${label}: ${subject.label}`).not.toMatch(subject.pattern);
  }
}

describe("troubleshooting and API vocabulary", () => {
  it("covers every REQ-101 symptom with actionable remediation", () => {
    for (const symptom of REQ_101_SYMPTOMS) {
      expect(troubleshooting, symptom.id).toContain(`## ${symptom.heading}`);
      expect(troubleshooting, symptom.id).toContain("**Fix.**");

      if ("readiness" in symptom) {
        const copy = READINESS_PRESENTATION[symptom.readiness];
        expect(troubleshooting, symptom.id).toContain(copy.explanation);
        expect(troubleshooting, symptom.id).toContain(copy.remediation.message);
      }
      if ("outcome" in symptom) {
        const copy = TERMINAL_OUTCOME_PRESENTATION[symptom.outcome];
        expect(troubleshooting, symptom.id).toContain(copy.title);
        expect(troubleshooting, symptom.id).toContain(copy.message);
      }
      if ("phrase" in symptom) {
        expect(troubleshooting, symptom.id).toContain(symptom.phrase);
      }
    }
  });

  it("names only readiness statuses the product can actually report", () => {
    const named = [...troubleshooting.matchAll(/Readiness (?:is|turns) `([a-z-]+)`/g)].map(
      ([, status]) => status,
    );

    expect(named.length).toBeGreaterThan(0);
    for (const status of named) {
      expect(READINESS_STATUSES, status).toContain(status);
    }
  });

  it("documents all six terminal outcomes and structured skipped probe language", () => {
    for (const outcome of TERMINAL_OUTCOMES) {
      const copy = TERMINAL_OUTCOME_PRESENTATION[outcome];
      expect(troubleshooting).toContain(copy.title);
      expect(troubleshooting).toContain(copy.message);
      expect(apiReference).toContain(copy.title);
    }

    const skipped = READINESS_PRESENTATION.skipped;
    expect(troubleshooting).toContain(skipped.explanation);
    expect(troubleshooting).toContain(skipped.remediation.message);
    expect(troubleshooting).toContain("enable-live-probe");
    expect(apiReference).toContain("skipped");
    expect(apiReference).toContain("never enables a product");
  });

  it("names exactly the outcomes that keep findings", () => {
    const [keep, drop] = TERMINAL_OUTCOMES.reduce<[string[], string[]]>(
      ([kept, dropped], outcome) =>
        terminalOutcomeKeepsFindings(outcome)
          ? [[...kept, outcome], dropped]
          : [kept, [...dropped, outcome]],
      [[], []],
    );

    const sentence = apiReference
      .split("\n")
      .find((line) => line.startsWith("Findings are carried by"));
    expect(sentence, "api.mdx must state which outcomes carry findings").toBeDefined();
    for (const outcome of keep) {
      expect(sentence, outcome).toContain(`\`${outcome}\``);
    }
    for (const outcome of drop) {
      expect(sentence, outcome).not.toContain(`\`${outcome}\``);
    }
  });

  it("avoids raw diagnostic or secret guidance and keeps Web/Ink/CLI terminology parity", () => {
    expectNoForbiddenGuidance(troubleshooting, "troubleshooting.mdx");
    expectNoForbiddenGuidance(apiReference, "api.mdx");

    expect(troubleshooting).toContain("Configuration Not Ready");
    expect(troubleshooting).toContain(CONFIGURE_PROVIDER_LABEL);
    // Anchored to the published action-table row so a removed action fails here.
    for (const action of ["create", "inspect", "select", "test", "update", "delete"]) {
      expect(apiReference, action).toContain(`| \`${action}\` |`);
    }

    for (const productId of ["gemini", "zai", "openrouter"] as const) {
      expect(troubleshooting).toContain(PRODUCT_REGISTRY[productId].presentation.name);
    }
  });
});

describe("web results guide", () => {
  const guide = readFileSync(
    resolve(import.meta.dirname, "../../../content/docs/app/web/results.mdx"),
    "utf8",
  );
  const reviewOutputReference = readFileSync(resolve(referenceRoot, "review-output.mdx"), "utf8");

  it("documents exact-set severity chips without threshold semantics", () => {
    expect(guide).toContain("multi-select severity chips");
    expect(guide).toContain("include exactly those severities");
    expect(guide).toContain("High by itself does not include Blocker");
    expect(guide).toContain("Reset clears the selection and shows every severity again");
    expect(guide).not.toMatch(/\bthreshold\b/i);
  });

  it("keeps Patch and Trace tab presence binary and structurally parallel", () => {
    expect(reviewOutputReference).toContain(
      "includes Patch exactly when `suggested_patch` contains a patch",
    );
    expect(reviewOutputReference).toContain(
      "includes Trace exactly when `trace` contains at least one step",
    );
    expect(reviewOutputReference).toContain(
      "A null patch, a missing trace, and an empty trace omit their respective tabs",
    );
    expect(reviewOutputReference).not.toContain("empty Trace tab");
  });
});
