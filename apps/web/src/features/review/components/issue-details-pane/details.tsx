import type { IssueDetailsPresentation } from "@diffgazer/core/review";
import {
  type EvidencePresentation,
  type ReviewIssue,
  toEvidencePresentation,
} from "@diffgazer/core/schemas/review";
import { CodeBlock } from "@diffgazer/ui/components/code-block";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { FixPlanChecklist } from "../fix-plan-checklist";

export function DetailsTabContent({
  issue,
  completedSteps,
  onToggleStep,
  focusedStepIndex,
  onFocusedStepIndexChange,
  presentation,
}: {
  issue: ReviewIssue;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
  focusedStepIndex?: number | null;
  onFocusedStepIndexChange?: (stepIndex: number) => void;
  presentation: IssueDetailsPresentation;
}) {
  const evidence = issue.evidence.map((item, ordinal) =>
    toEvidencePresentation(item, issue.file, ordinal),
  );
  const codeEvidence = evidence.filter(
    (item): item is Extract<EvidencePresentation, { kind: "code" }> => item.kind === "code",
  );
  const referenceEvidence = evidence.filter((item) => item.kind === "reference");

  return (
    <>
      <div className="mb-6">
        <SectionHeader>SYMPTOM</SectionHeader>
        <p className="text-sm leading-relaxed text-foreground/80">{issue.symptom}</p>
        {codeEvidence.length > 0 && (
          <section aria-label="Evidence" tabIndex={-1} className="mt-2 space-y-3">
            {codeEvidence.map((item) => (
              <CodeEvidence
                key={`${item.type}:${item.ordinal}`}
                item={item}
                endLine={issue.evidence[item.ordinal]?.range?.end}
              />
            ))}
          </section>
        )}
        {referenceEvidence.length > 0 && (
          <div className="mt-3 space-y-3">
            {referenceEvidence.map((item) => (
              <EvidenceReference key={`${item.type}:${item.ordinal}`} item={item} />
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <SectionHeader>WHY IT MATTERS</SectionHeader>
        <p className="text-sm leading-relaxed text-foreground/80">{issue.whyItMatters}</p>
      </div>

      {presentation.fixPlan.length > 0 && (
        <div className="mb-6">
          <SectionHeader>FIX PLAN</SectionHeader>
          <FixPlanChecklist
            steps={presentation.fixPlan}
            completedSteps={completedSteps}
            onToggle={onToggleStep}
            focusedStepIndex={focusedStepIndex}
            onFocusedIndexChange={onFocusedStepIndexChange}
          />
        </div>
      )}

      {issue.betterOptions && issue.betterOptions.length > 0 && (
        <div className="mb-6">
          <SectionHeader>BETTER OPTIONS</SectionHeader>
          <ul className="list-disc pl-4 space-y-1">
            {issue.betterOptions.map((opt, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: option text can repeat; backend order is the rendered identity.
              <li key={index} className="text-sm leading-relaxed text-foreground/80">
                {opt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {issue.testsToAdd && issue.testsToAdd.length > 0 && (
        <div className="mb-6">
          <SectionHeader>TESTS TO ADD</SectionHeader>
          <ul className="list-disc pl-4 space-y-1">
            {issue.testsToAdd.map((test, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: test text can repeat; backend order is the rendered identity.
              <li key={index} className="text-sm leading-relaxed text-foreground/80">
                {test}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const EMPTY_EVIDENCE_EXCERPT = "(empty excerpt)";

function CodeEvidence({
  item,
  endLine,
}: {
  item: Extract<EvidencePresentation, { kind: "code" }>;
  endLine?: number;
}) {
  const lines = item.excerpt.length > 0 ? item.excerpt.split(/\r?\n/) : [EMPTY_EVIDENCE_EXCERPT];

  return (
    <div className="border-l-2 border-border pl-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {item.label}
        </span>
        <span className="text-sm font-medium text-foreground">{item.title}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Source: <span className="font-mono text-foreground/80">{item.sourceText}</span>
      </div>
      <div className="mb-1 text-xs text-muted-foreground">
        File: <span className="font-mono text-foreground/80">{item.file}</span>
      </div>
      <CodeBlock label={`${item.label}: ${item.title}`}>
        <CodeBlock.Content tabIndex={-1}>
          {lines.map((line, offset) => (
            <CodeBlock.Line
              key={`${item.ordinal}:${offset}`}
              number={
                item.startLine === undefined ||
                (endLine !== undefined && item.startLine + offset > endLine)
                  ? undefined
                  : item.startLine + offset
              }
              content={line}
              state="highlight"
            />
          ))}
        </CodeBlock.Content>
      </CodeBlock>
    </div>
  );
}

function EvidenceReference({
  item,
}: {
  item: Extract<EvidencePresentation, { kind: "reference" }>;
}) {
  return (
    <section aria-label={`${item.label}: ${item.title}`} className="border-l-2 border-border pl-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {item.label}
        </span>
        <span className="text-sm font-medium text-foreground">{item.title}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Source: <span className="font-mono text-foreground/80">{item.sourceText}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
        {item.excerpt}
      </p>
    </section>
  );
}
