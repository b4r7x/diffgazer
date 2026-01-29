import { cn } from "@/lib/utils";
import { Button, CodeSnippet, DiffView, FixPlanChecklist, type CodeLine } from "@/components/ui";
import { SEVERITY_CONFIG, type SeverityLevel } from "@/features/review/constants/severity";
import type { TriageIssue } from "@repo/schemas";

export type TabId = "details" | "explain" | "trace" | "patch";

export interface IssueDetailsPaneProps {
  issue: TriageIssue | null;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
  isFocused: boolean;
  className?: string;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "details", label: "Details" },
  { id: "explain", label: "Explain" },
  { id: "trace", label: "Trace" },
  { id: "patch", label: "Patch" },
];

export function IssueDetailsPane({
  issue,
  activeTab,
  onTabChange,
  completedSteps,
  onToggleStep,
  isFocused,
  className,
}: IssueDetailsPaneProps) {
  const visibleTabs = TABS.filter((tab) => tab.id !== "patch" || issue?.suggested_patch);

  return (
    <div
      className={cn(
        "w-3/5 flex flex-col pl-4",
        isFocused && "ring-1 ring-tui-blue ring-inset",
        className
      )}
    >
      <div className="flex border-b border-tui-border pb-2 pt-2 mb-4 text-sm">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.id}
            variant="tab"
            data-active={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className="mr-4"
          >
            {activeTab === tab.id ? `[${tab.label}]` : tab.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pr-2">
        {issue ? (
          <>
            <IssueHeader issue={issue} />

            {activeTab === "details" && (
              <DetailsTabContent issue={issue} completedSteps={completedSteps} onToggleStep={onToggleStep} />
            )}

            {activeTab === "explain" && (
              <div className="text-sm text-gray-300">
                <p className="mb-4">{issue.rationale}</p>
                <p>{issue.recommendation}</p>
              </div>
            )}

            {activeTab === "trace" && (
              <TraceTabContent issue={issue} />
            )}

            {activeTab === "patch" && issue.suggested_patch && (
              <DiffView patch={issue.suggested_patch} />
            )}
          </>
        ) : (
          <div className="text-gray-500 text-center py-8">Select an issue to view details</div>
        )}
      </div>
    </div>
  );
}

function IssueHeader({ issue }: { issue: TriageIssue }) {
  const severity = issue.severity as SeverityLevel;

  return (
    <div className="mb-6">
      <h1
        className={cn(
          "text-xl font-bold mb-1",
          severity === "blocker" && "text-tui-red",
          severity === "high" && "text-tui-yellow",
          severity === "medium" && "text-gray-300",
          severity === "low" && "text-gray-400"
        )}
      >
        {issue.title}
      </h1>
      <div className="text-xs text-gray-500">
        Location: <span className="text-tui-fg">src/{issue.file}:{issue.line_start}</span>
      </div>
    </div>
  );
}

function DetailsTabContent({
  issue,
  completedSteps,
  onToggleStep,
}: {
  issue: TriageIssue;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
}) {
  const evidenceLines: CodeLine[] = issue.evidence.length > 0
    ? [
        { number: (issue.line_start ?? 1) - 1, content: issue.evidence[0]?.excerpt ?? "" },
        { number: issue.line_start ?? 1, content: "const result = await db.query(query); <-- UNSAFE", type: "highlight" },
      ]
    : [];

  return (
    <>
      <div className="mb-6">
        <h3 className="text-tui-blue font-bold mb-2 uppercase text-xs tracking-wider">SYMPTOM</h3>
        <p className="text-sm leading-relaxed text-gray-300">{issue.symptom}</p>
        {evidenceLines.length > 0 && (
          <div className="mt-2">
            <CodeSnippet lines={evidenceLines} />
          </div>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-tui-blue font-bold mb-2 uppercase text-xs tracking-wider">WHY IT MATTERS</h3>
        <p className="text-sm leading-relaxed text-gray-300">{issue.whyItMatters}</p>
        {issue.category === "security" && (
          <div className="mt-2 flex gap-2">
            <span className="border border-tui-red text-tui-red text-[10px] px-1">CWE-89</span>
            <span className="border border-tui-red text-tui-red text-[10px] px-1">OWASP A03</span>
          </div>
        )}
      </div>

      {issue.fixPlan && issue.fixPlan.length > 0 && (
        <div className="mb-6">
          <h3 className="text-tui-blue font-bold mb-2 uppercase text-xs tracking-wider">FIX PLAN</h3>
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

function TraceTabContent({ issue }: { issue: TriageIssue }) {
  if (!issue.trace || issue.trace.length === 0) {
    return <div className="text-sm text-gray-500 italic">No trace data available for this issue.</div>;
  }

  return (
    <div className="space-y-2">
      {issue.trace.map((t) => (
        <div key={t.step} className="border-l-2 border-tui-border pl-2">
          <div className="text-tui-fg text-sm">Step {t.step}: {t.tool}</div>
          <div className="text-gray-500 text-xs">{t.outputSummary}</div>
        </div>
      ))}
    </div>
  );
}
