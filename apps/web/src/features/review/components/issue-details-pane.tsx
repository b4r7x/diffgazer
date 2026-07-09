import { type DetailsEmptyKind, getDetailsEmptyCopy } from "@diffgazer/core/review";
import { isIssueTab, type IssueTab as TabId } from "@diffgazer/core/schemas/presentation";
import type { EvidenceRef, ReviewIssue } from "@diffgazer/core/schemas/review";
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
              file={issue.file}
              line={issue.line_start}
            />

            <TabsContent value="details" tabIndex={-1} className="mt-0">
              <DetailsTabContent
                issue={issue}
                completedSteps={completedSteps}
                onToggleStep={onToggleStep}
                focusedStepIndex={focusedStepIndex}
              />
            </TabsContent>

            <TabsContent value="explain" tabIndex={-1} className="mt-0">
              <div className="text-sm text-foreground/80">
                <p className="mb-4">{issue.rationale}</p>
                <p>{issue.recommendation}</p>
              </div>
            </TabsContent>

            {hasTrace && (
              <TabsContent value="trace" tabIndex={-1} className="mt-0">
                <TraceTabContent issue={issue} />
              </TabsContent>
            )}

            {hasPatch && issue.suggested_patch && (
              <TabsContent value="patch" tabIndex={-1} className="mt-0">
                <PatchTabContent patch={issue.suggested_patch} evidence={issue.evidence} />
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
        "mt-3 w-3/5 flex flex-col min-h-0 border border-border data-[focused]:border-info",
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

function getPlainSnippetBeforeSide(patch: string, evidence: EvidenceRef[]) {
  const codeExcerpts = evidence.filter((e) => e.type === "code" && e.excerpt).map((e) => e.excerpt);

  if (codeExcerpts.length === 1) return codeExcerpts[0];

  const patchLines = new Set(patch.split(/\r?\n/).filter((line) => line.length > 0));
  return codeExcerpts.find((excerpt) =>
    excerpt.split(/\r?\n/).some((line) => patchLines.has(line)),
  );
}

function PatchTabContent({ patch, evidence }: { patch: string; evidence: EvidenceRef[] }) {
  if (canRenderStructuredPatch(patch)) {
    return <DiffView patch={patch} label="Suggested patch" />;
  }

  if (!DIFF_MARKER_RE.test(patch)) {
    const original = getPlainSnippetBeforeSide(patch, evidence);
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
}: {
  issue: ReviewIssue;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
  focusedStepIndex?: number | null;
}) {
  const evidenceLines = issue.evidence
    .filter((e) => e.type === "code" && e.excerpt)
    .map((e, index) => ({
      key: index,
      number: e.range?.start,
      content: e.excerpt,
      state: "highlight" as CodeBlockLineState,
    }));

  return (
    <>
      <div className="mb-6">
        <SectionHeader>SYMPTOM</SectionHeader>
        <p className="text-sm leading-relaxed text-foreground/80">{issue.symptom}</p>
        {evidenceLines.length > 0 && (
          <div className="mt-2">
            <CodeBlock label="Evidence">
              <CodeBlock.Content tabIndex={-1}>
                {evidenceLines.map((line) => (
                  <CodeBlock.Line
                    key={line.key}
                    number={line.number}
                    content={line.content}
                    state={line.state}
                  />
                ))}
              </CodeBlock.Content>
            </CodeBlock>
          </div>
        )}
      </div>

      <div className="mb-6">
        <SectionHeader>WHY IT MATTERS</SectionHeader>
        <p className="text-sm leading-relaxed text-foreground/80">{issue.whyItMatters}</p>
      </div>

      {issue.fixPlan && issue.fixPlan.length > 0 && (
        <div className="mb-6">
          <SectionHeader>FIX PLAN</SectionHeader>
          <FixPlanChecklist
            steps={issue.fixPlan}
            completedSteps={completedSteps}
            onToggle={onToggleStep}
            focusedStepIndex={focusedStepIndex}
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
            {issue.testsToAdd.map((test) => (
              <li key={test} className="text-sm leading-relaxed text-foreground/80">
                {test}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function TraceTabContent({ issue }: { issue: ReviewIssue }) {
  if (!issue.trace || issue.trace.length === 0) {
    return <EmptyState variant="inline">No trace data available for this issue.</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {issue.trace.map((t) => (
        <div key={t.step} className="border-l-2 border-border pl-2">
          <div className="text-foreground text-sm">
            Step {t.step}: {t.tool}
          </div>
          <div className="text-muted-foreground text-xs">{t.outputSummary}</div>
        </div>
      ))}
    </div>
  );
}
