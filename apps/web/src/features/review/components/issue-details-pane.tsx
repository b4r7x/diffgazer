import { type Ref } from "react";
import { cn } from "@diffgazer/ui/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@diffgazer/ui/components/tabs";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { CodeBlock, type CodeBlockLineState } from "@diffgazer/ui/components/code-block";
import { DiffView, parseDiff } from "@diffgazer/ui/components/diff-view";
import { Panel } from "@diffgazer/ui/components/panel";
import { FixPlanChecklist } from "./fix-plan-checklist";
import { IssueHeader } from "./issue-header";

import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { isIssueTab, type IssueTab as TabId } from "@diffgazer/core/schemas/ui";
import type { DetailsEmptyKind } from "@diffgazer/core/review";

export type { DetailsEmptyKind };

export interface IssueDetailsPaneProps {
  issue: ReviewIssue | null;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
  scrollAreaRef?: Ref<HTMLDivElement>;
  isFocused: boolean;
  emptyKind?: DetailsEmptyKind;
  className?: string;
}

const EMPTY_COPY: Record<DetailsEmptyKind, { title: string; description?: string }> = {
  "no-issues": {
    title: "No issues in this review",
    description: "This analysis passed without findings.",
  },
  "filter-empty": {
    title: "No issues match this filter",
    description: "Choose another severity to continue.",
  },
  "no-selection": { title: "Select an issue to view details" },
};

export function IssueDetailsPane({
  issue,
  activeTab,
  onTabChange,
  completedSteps,
  onToggleStep,
  scrollAreaRef,
  isFocused,
  emptyKind,
  className,
}: IssueDetailsPaneProps) {
  const hasPatch = !!issue?.suggested_patch;
  const empty = EMPTY_COPY[emptyKind ?? "no-selection"];
  const handleTabChange = (value: string) => {
    if (isIssueTab(value)) onTabChange(value);
  };

  if (!issue) {
    return (
      <Panel
        as="aside"
        aria-label="Issue details"
        data-pane="details"
        data-focused={isFocused || undefined}
        className={cn(
          "w-3/5 flex flex-col min-h-0 overflow-hidden border border-tui-border data-[focused]:border-tui-blue",
          className,
        )}
      >
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
                  <div className="text-xs text-tui-muted">{empty.description}</div>
                )}
              </div>
            </EmptyState>
          </ScrollArea>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      as="aside"
      aria-label="Issue details"
      data-pane="details"
      data-focused={isFocused || undefined}
      className={cn(
        "w-3/5 flex flex-col min-h-0 overflow-hidden border border-tui-border data-[focused]:border-tui-blue",
        className,
      )}
    >
      <div className="flex flex-1 min-h-0 flex-col px-3">
        <Tabs value={activeTab} onChange={handleTabChange} className="flex flex-1 min-h-0 flex-col">
          <TabsList className="border-b border-tui-border pb-2 pt-2 mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="explain">Explain</TabsTrigger>
            <TabsTrigger value="trace">Trace</TabsTrigger>
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
              line={issue.line_start ?? 0}
            />

            <TabsContent value="details" className="mt-0">
              <DetailsTabContent issue={issue} completedSteps={completedSteps} onToggleStep={onToggleStep} />
            </TabsContent>

            <TabsContent value="explain" className="mt-0">
              <div className="text-sm text-tui-fg/80">
                <p className="mb-4">{issue.rationale}</p>
                <p>{issue.recommendation}</p>
              </div>
            </TabsContent>

            <TabsContent value="trace" className="mt-0">
              <TraceTabContent issue={issue} />
            </TabsContent>

            {hasPatch && issue.suggested_patch && (
              <TabsContent value="patch" className="mt-0">
                <PatchTabContent patch={issue.suggested_patch} />
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </div>
    </Panel>
  );
}

function canRenderStructuredPatch(patch: string) {
  const files = parseDiff(patch);
  return files.length === 1 && files[0]?.hunks.length > 0;
}

function getPatchLineState(line: string): CodeBlockLineState | undefined {
  if (line.startsWith("+") && !line.startsWith("+++")) return "added";
  if (line.startsWith("-") && !line.startsWith("---")) return "removed";
  return undefined;
}

function PatchTabContent({ patch }: { patch: string }) {
  if (canRenderStructuredPatch(patch)) {
    return <DiffView patch={patch} />;
  }

  return (
    <CodeBlock label="Suggested patch">
      <CodeBlock.Content tone="diff">
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
}: {
  issue: ReviewIssue;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
}) {
  const evidenceLines = issue.evidence
    .filter((e) => e.type === "code" && e.excerpt)
    .map((e, i) => ({
      number: e.range?.start ?? issue.line_start ?? i + 1,
      content: e.excerpt,
      state: "highlight" as CodeBlockLineState,
    }));

  return (
    <>
      <div className="mb-6">
        <SectionHeader>SYMPTOM</SectionHeader>
        <p className="text-sm leading-relaxed text-tui-fg/80">{issue.symptom}</p>
        {evidenceLines.length > 0 && (
          <div className="mt-2">
            <CodeBlock label="Evidence">
              <CodeBlock.Content>
                {evidenceLines.map((line) => (
                  <CodeBlock.Line
                    key={`${line.number}-${line.content}`}
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
        <p className="text-sm leading-relaxed text-tui-fg/80">{issue.whyItMatters}</p>
      </div>

      {issue.fixPlan && issue.fixPlan.length > 0 && (
        <div className="mb-6">
          <SectionHeader>FIX PLAN</SectionHeader>
          <FixPlanChecklist
            steps={issue.fixPlan}
            completedSteps={completedSteps}
            onToggle={onToggleStep}
          />
        </div>
      )}

      {issue.betterOptions && issue.betterOptions.length > 0 && (
        <div className="mb-6">
          <SectionHeader>BETTER OPTIONS</SectionHeader>
          <ul className="list-disc pl-4 space-y-1">
            {issue.betterOptions.map((opt) => (
              <li key={opt} className="text-sm leading-relaxed text-tui-fg/80">{opt}</li>
            ))}
          </ul>
        </div>
      )}

      {issue.testsToAdd && issue.testsToAdd.length > 0 && (
        <div className="mb-6">
          <SectionHeader>TESTS TO ADD</SectionHeader>
          <ul className="list-disc pl-4 space-y-1">
            {issue.testsToAdd.map((test) => (
              <li key={test} className="text-sm leading-relaxed text-tui-fg/80">{test}</li>
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
        <div key={t.step} className="border-l-2 border-tui-border pl-2">
          <div className="text-tui-fg text-sm">Step {t.step}: {t.tool}</div>
          <div className="text-tui-muted text-xs">{t.outputSummary}</div>
        </div>
      ))}
    </div>
  );
}
