import { useRef, type Ref } from "react";
import { cn } from "@/utils/cn";
import { Tabs, TabsList, TabsTrigger, TabsContent, FocusablePane, SectionHeader, EmptyState, ScrollArea } from "@diffgazer/ui";
import { useTabNavigation } from "@diffgazer/keyboard";
import { CodeSnippet, type CodeLine } from "./code-snippet";
import { DiffView } from "./diff-view";
import { FixPlanChecklist } from "./fix-plan-checklist";
import { IssueHeader } from "./issue-header";

import type { ReviewIssue } from "@diffgazer/schemas/review";
import type { IssueTab as TabId } from "@diffgazer/schemas/ui";

export interface IssueDetailsPaneProps {
  issue: ReviewIssue | null;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
  scrollAreaRef?: Ref<HTMLDivElement>;
  isFocused: boolean;
  className?: string;
}

export function IssueDetailsPane({
  issue,
  activeTab,
  onTabChange,
  completedSteps,
  onToggleStep,
  scrollAreaRef,
  isFocused,
  className,
}: IssueDetailsPaneProps) {
  const hasPatch = !!issue?.suggested_patch;
  const tabsRef = useRef<HTMLDivElement>(null);

  const { onKeyDown: tabsKeyDown } = useTabNavigation({
    containerRef: tabsRef,
  });

  return (
    <FocusablePane isFocused={isFocused} className={cn("w-3/5 flex flex-col pl-4 min-h-0", className)}>
      <div ref={tabsRef} className="flex flex-1 min-h-0 flex-col">
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-1 min-h-0 flex-col">
          <TabsList className="border-b border-tui-border pb-2 pt-2 mb-4" onKeyDown={tabsKeyDown}>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="explain">Explain</TabsTrigger>
            <TabsTrigger value="trace">Trace</TabsTrigger>
            {hasPatch && <TabsTrigger value="patch">Patch</TabsTrigger>}
          </TabsList>

          <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 pr-2">
            {issue ? (
              <>
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
                    <DiffView patch={issue.suggested_patch} />
                  </TabsContent>
                )}
              </>
            ) : (
              <EmptyState message="Select an issue to view details" />
            )}
          </ScrollArea>
        </Tabs>
      </div>
    </FocusablePane>
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
  const evidenceLines: CodeLine[] = issue.evidence
    .filter((e) => e.type === "code" && e.excerpt)
    .map((e, i) => ({
      number: e.range?.start ?? issue.line_start ?? i + 1,
      content: e.excerpt,
      type: "highlight" as const,
    }));

  return (
    <>
      <div className="mb-6">
        <SectionHeader>SYMPTOM</SectionHeader>
        <p className="text-sm leading-relaxed text-tui-fg/80">{issue.symptom}</p>
        {evidenceLines.length > 0 && (
          <div className="mt-2">
            <CodeSnippet lines={evidenceLines} />
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
    </>
  );
}

function TraceTabContent({ issue }: { issue: ReviewIssue }) {
  if (!issue.trace || issue.trace.length === 0) {
    return <EmptyState message="No trace data available for this issue." variant="inline" />;
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
