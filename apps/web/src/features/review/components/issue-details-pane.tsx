import {
  type DetailsEmptyKind,
  getDetailsEmptyCopy,
  type IssueDetailsPresentation,
  toIssueDetailsPresentation,
} from "@diffgazer/core/review";
import { isIssueTab, type IssueTab as TabId } from "@diffgazer/core/schemas/presentation";
import {
  type EvidencePresentation,
  type EvidenceRef,
  type ReviewIssue,
  toEvidencePresentation,
} from "@diffgazer/core/schemas/review";
import { CodeBlock, type CodeBlockLineState } from "@diffgazer/ui/components/code-block";
import { DiffView, parseDiff } from "@diffgazer/ui/components/diff-view";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@diffgazer/ui/components/tabs";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode, Ref } from "react";
import { FixPlanChecklist } from "./fix-plan-checklist";
import { IssueHeader } from "./issue-header";

export type { DetailsEmptyKind };

export interface IssueDetailsPaneProps {
  issue: ReviewIssue | null;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onTabsBoundaryReached?: (direction: "previous" | "next") => void;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
  focusedStepIndex?: number | null;
  onFocusedStepIndexChange?: (stepIndex: number) => void;
  paneRef?: Ref<HTMLElement>;
  scrollAreaRef?: Ref<HTMLDivElement>;
  isFocused: boolean;
  emptyKind?: DetailsEmptyKind;
  className?: string;
}

export function IssueDetailsPane({
  issue,
  activeTab,
  onTabChange,
  onTabsBoundaryReached,
  completedSteps,
  onToggleStep,
  focusedStepIndex,
  onFocusedStepIndexChange,
  paneRef,
  scrollAreaRef,
  isFocused,
  emptyKind,
  className,
}: IssueDetailsPaneProps) {
  const hasPatch = !!issue?.suggested_patch;
  const hasTrace = !!issue?.trace?.length;
  const empty = getDetailsEmptyCopy(emptyKind ?? "no-selection");
  const handleTabChange = (value: string) => {
    if (isIssueTab(value)) onTabChange(value);
  };

  if (!issue) {
    return (
      <DetailsPanel paneRef={paneRef} isFocused={isFocused} className={className}>
        <div className="flex flex-1 min-h-0 flex-col px-3 py-2">
          <ScrollArea
            ref={scrollAreaRef}
            aria-label="Issue details"
            keyboardScrollable={false}
            tabIndex={-1}
            className="flex-1 min-h-0 focus:outline-none"
          >
            <EmptyState className="h-full min-h-[20rem]">
              <div className="space-y-2">
                <div>{empty.title}</div>
                {empty.description && (
                  <div className="text-xs text-muted-foreground">{empty.description}</div>
                )}
              </div>
            </EmptyState>
          </ScrollArea>
        </div>
      </DetailsPanel>
    );
  }

  const presentation = toIssueDetailsPresentation(issue);

  return (
    <DetailsPanel paneRef={paneRef} isFocused={isFocused} className={className}>
      <div className="flex flex-1 min-h-0 flex-col px-3">
        <Tabs value={activeTab} onChange={handleTabChange} className="flex flex-1 min-h-0 flex-col">
          <TabsList
            loop={false}
            onNavigationBoundaryReached={(direction) => onTabsBoundaryReached?.(direction)}
            className="border-b border-border pb-2 pt-3 mb-4"
          >
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="explain">Explain</TabsTrigger>
            {hasTrace && <TabsTrigger value="trace">Trace</TabsTrigger>}
            {hasPatch && <TabsTrigger value="patch">Patch</TabsTrigger>}
          </TabsList>

          <ScrollArea
            ref={scrollAreaRef}
            aria-label="Issue details"
            keyboardScrollable={false}
            tabIndex={-1}
            className="flex-1 min-h-0 pr-2 focus:outline-none"
          >
            <IssueHeader
              title={issue.title}
              severity={issue.severity}
              presentation={presentation}
            />

            <TabsContent value="details" tabIndex={-1} className="mt-0">
              <DetailsTabContent
                issue={issue}
                completedSteps={completedSteps}
                onToggleStep={onToggleStep}
                focusedStepIndex={focusedStepIndex}
                onFocusedStepIndexChange={onFocusedStepIndexChange}
                presentation={presentation}
              />
            </TabsContent>

            <TabsContent value="explain" tabIndex={-1} className="mt-0">
              <div className="text-sm text-foreground/80">
                <SectionHeader as="h2">Rationale</SectionHeader>
                <p className="mb-4">{issue.rationale}</p>
                <SectionHeader as="h2">Recommendation</SectionHeader>
                <p>{issue.recommendation}</p>
              </div>
            </TabsContent>

            {hasTrace && (
              <TabsContent value="trace" tabIndex={-1} className="mt-0">
                <TraceTabContent trace={presentation.trace} />
              </TabsContent>
            )}

            {hasPatch && issue.suggested_patch && (
              <TabsContent value="patch" tabIndex={-1} className="mt-0">
                <PatchTabContent
                  patch={issue.suggested_patch}
                  targetFile={issue.file}
                  evidence={issue.evidence}
                />
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </div>
    </DetailsPanel>
  );
}

function DetailsPanel({
  paneRef,
  isFocused,
  className,
  children,
}: {
  paneRef?: Ref<HTMLElement>;
  isFocused: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Panel
      as="aside"
      ref={paneRef}
      aria-label="Issue details"
      data-pane="details"
      data-focused={isFocused || undefined}
      className={cn(
        "mt-3 flex min-h-0 w-full basis-3/5 flex-col border border-border data-[focused]:border-info md:w-3/5 md:basis-auto",
        className,
      )}
    >
      <Panel.Label variant="border" aria-hidden="true">
        Details
      </Panel.Label>
      {children}
    </Panel>
  );
}

function canRenderStructuredPatch(patch: string) {
  const files = parseDiff(patch);
  if (files.length !== 1) return false;
  const [file] = files;
  return file !== undefined && file.hunks.length > 0;
}

function getPatchLineState(line: string): CodeBlockLineState | undefined {
  if (line.startsWith("+") && !line.startsWith("+++")) return "added";
  if (line.startsWith("-") && !line.startsWith("---")) return "removed";
  return undefined;
}

const DIFF_MARKER_RE = /^(\+|-|@@)/m;

function getPlainSnippetBeforeSide(patch: string, targetFile: string, evidence: EvidenceRef[]) {
  const patchLines = new Set(patch.split(/\r?\n/).filter((line) => line.length > 0));
  return evidence
    .filter(
      (item): item is EvidenceRef & { type: "code"; file: string } =>
        item.type === "code" && item.file === targetFile && item.excerpt.length > 0,
    )
    .map((item) => item.excerpt)
    .find((excerpt) => excerpt.split(/\r?\n/).some((line) => patchLines.has(line)));
}

function PatchTabContent({
  patch,
  targetFile,
  evidence,
}: {
  patch: string;
  targetFile: string;
  evidence: EvidenceRef[];
}) {
  if (canRenderStructuredPatch(patch)) {
    return <DiffView patch={patch} label="Suggested patch" />;
  }

  if (!DIFF_MARKER_RE.test(patch)) {
    const original = getPlainSnippetBeforeSide(patch, targetFile, evidence);
    if (original) {
      return <DiffView before={original} after={patch} label="Suggested patch" />;
    }
  }

  return (
    <CodeBlock label="Suggested patch">
      <CodeBlock.Content tabIndex={-1}>
        {patch.split("\n").map((line, index) => (
          <CodeBlock.Line
            key={`${index}-${line}`}
            number={index + 1}
            content={line}
            state={getPatchLineState(line)}
          />
        ))}
      </CodeBlock.Content>
    </CodeBlock>
  );
}

function DetailsTabContent({
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

function TraceTabContent({ trace }: Pick<IssueDetailsPresentation, "trace">) {
  if (trace.length === 0) {
    return <EmptyState variant="inline">No trace data available for this issue.</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {trace.map((step) => (
        <div key={step.step} className="border-l-2 border-border pl-2">
          <div className="text-foreground text-sm">
            Step {step.step}: {step.tool}
          </div>
          <div className="text-muted-foreground text-xs">
            <span>{step.input.label} </span>
            {step.input.summary}
          </div>
          <div className="text-muted-foreground text-xs">
            <span>{step.output.label} </span>
            {step.output.summary}
          </div>
        </div>
      ))}
    </div>
  );
}
