import {
  type DetailsEmptyKind,
  getDetailsEmptyCopy,
  toIssueDetailsPresentation,
} from "@diffgazer/core/review";
import { isIssueTab, type IssueTab as TabId } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@diffgazer/ui/components/tabs";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode, Ref } from "react";
import { IssueHeader } from "../issue-header";
import { DetailsTabContent } from "./details";
import { PatchTabContent } from "./patch";
import { TraceTabContent } from "./trace";

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
