import {
  type EvidencePresentation,
  type IssueDetailsPresentation,
  toEvidencePresentation,
} from "@diffgazer/core/review";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { CodeBlock } from "@diffgazer/ui/components/code-block";
import { Panel } from "@diffgazer/ui/components/panel";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { PathValue } from "@/components/shared/path-value";
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
  completedSteps: ReadonlySet<number>;
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
        <SectionHeader as="h2" className="mb-2">
          SYMPTOM
        </SectionHeader>
        <p className="text-sm leading-relaxed text-foreground/80">{issue.symptom}</p>
        {codeEvidence.length > 0 && (
          <section aria-label="Evidence" tabIndex={-1} className="mt-2 space-y-3">
            {codeEvidence.map((item) => (
              <CodeEvidence key={`${item.type}:${item.ordinal}`} item={item} />
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
        <SectionHeader as="h2" className="mb-2">
          WHY IT MATTERS
        </SectionHeader>
        <p className="text-sm leading-relaxed text-foreground/80">{issue.whyItMatters}</p>
      </div>

      {presentation.fixPlan.length > 0 && (
        <div className="mb-6">
          <SectionHeader as="h2" className="mb-2">
            FIX PLAN
          </SectionHeader>
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
          <SectionHeader as="h2" className="mb-2">
            BETTER OPTIONS
          </SectionHeader>
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
          <SectionHeader as="h2" className="mb-2">
            TESTS TO ADD
          </SectionHeader>
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

function CodeEvidence({ item }: { item: Extract<EvidencePresentation, { kind: "code" }> }) {
  const lines = item.excerpt.length > 0 ? item.excerpt.split(/\r?\n/) : [EMPTY_EVIDENCE_EXCERPT];

  return (
    // Rail, not the default enclosure: an aside annotates the issue prose it sits
    // beside, where a boxed panel would read as a section of its own. Every aside in
    // the issue detail tabs — reference evidence, trace steps — makes the same call.
    <Panel frame="rail" density="compact">
      <Panel.Content spacing="none">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {item.label}
          </span>
          <span className="text-sm font-medium text-foreground">{item.title}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Source: <span className="font-mono text-foreground/80">{item.sourceText}</span>
        </div>
        <div className="mb-1 flex min-w-0 text-xs text-muted-foreground">
          <span className="shrink-0">File:&nbsp;</span>
          <PathValue value={item.file} className="text-foreground/80" />
        </div>
        <CodeBlock label={`${item.label}: ${item.title}`}>
          <CodeBlock.Content tabIndex={-1}>
            {lines.map((line, offset) => (
              <CodeBlock.Line
                key={`${item.ordinal}:${offset}`}
                // Number every row, including any past range.end: a line without a
                // number renders no gutter cell at all, so a mixed block steps its indent.
                number={item.startLine === undefined ? undefined : item.startLine + offset}
                content={line}
              />
            ))}
          </CodeBlock.Content>
        </CodeBlock>
      </Panel.Content>
    </Panel>
  );
}

function EvidenceReference({
  item,
}: {
  item: Extract<EvidencePresentation, { kind: "reference" }>;
}) {
  return (
    <Panel frame="rail" density="compact" aria-label={`${item.label}: ${item.title}`}>
      <Panel.Content spacing="none">
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
      </Panel.Content>
    </Panel>
  );
}
