import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useScope, useKey } from "@/hooks/keyboard";
import type { TriageIssue, TriageSeverity, FixPlanStep } from "@repo/schemas";

type TabId = "details" | "explain" | "trace" | "patch";
type SeverityFilter = TriageSeverity | "all";
type FocusPane = "list" | "details";

const MOCK_ISSUES: TriageIssue[] = [
  {
    id: "1",
    severity: "blocker",
    category: "security",
    title: "Potential SQL Injection",
    file: "auth/login.ts",
    line_start: 42,
    line_end: 42,
    rationale: "User input directly concatenated into SQL query",
    recommendation: "Use parameterized queries",
    suggested_patch: `- const query = \`SELECT * FROM users WHERE user = '\${username}'\`;
+ const query = 'SELECT * FROM users WHERE user = ?';
+ const result = await db.query(query, [username]);`,
    confidence: 0.95,
    symptom:
      "The input variable username is concatenated directly into a raw SQL query string without sanitization. This occurs on line 42 within the authentication logic.",
    whyItMatters:
      "This vulnerability allows malicious users to manipulate the query logic by injecting arbitrary SQL commands. An attacker could bypass authentication.",
    fixPlan: [
      {
        step: 1,
        action: "Import parameterized query builder",
        files: ["auth/login.ts"],
      },
      { step: 2, action: "Replace string concatenation with bound parameters" },
      { step: 3, action: "Validate input type before query execution" },
    ],
    evidence: [
      {
        type: "code",
        title: "Vulnerable code",
        sourceId: "src-1",
        file: "auth/login.ts",
        excerpt:
          "const query = `SELECT * FROM users WHERE user = '${username}'`;",
      },
    ],
  },
  {
    id: "2",
    severity: "blocker",
    category: "security",
    title: "Unsafe Deserialization",
    file: "api/handlers/data.ts",
    line_start: 88,
    line_end: 92,
    rationale: "Deserializing untrusted data without validation",
    recommendation: "Validate data schema before deserialization",
    suggested_patch: null,
    confidence: 0.9,
    symptom:
      "The JSON.parse call on line 88 deserializes user-provided data without any schema validation.",
    whyItMatters:
      "Attackers can craft malicious payloads that exploit prototype pollution or execute arbitrary code during object reconstruction.",
    fixPlan: [
      { step: 1, action: "Add Zod schema for expected data structure" },
      { step: 2, action: "Validate parsed data against schema" },
    ],
    evidence: [],
  },
  {
    id: "3",
    severity: "high",
    category: "performance",
    title: "Memory Leak in Loop",
    file: "services/processor.ts",
    line_start: 150,
    line_end: 165,
    rationale: "Event listeners added in loop without cleanup",
    recommendation: "Store references and remove listeners on cleanup",
    suggested_patch: null,
    confidence: 0.85,
    symptom:
      "Event listeners are attached inside a forEach loop without any mechanism to remove them.",
    whyItMatters:
      "Each iteration creates a new listener that persists in memory. Over time, this causes memory exhaustion and degraded performance.",
    fixPlan: [
      { step: 1, action: "Store listener references in array" },
      { step: 2, action: "Add cleanup function to remove all listeners" },
    ],
    evidence: [],
  },
  {
    id: "4",
    severity: "high",
    category: "correctness",
    title: "Missing Error Handling",
    file: "utils/api-client.ts",
    line_start: 24,
    line_end: 28,
    rationale: "Network request has no error handling",
    recommendation: "Wrap in try-catch or use .catch()",
    suggested_patch: null,
    confidence: 0.88,
    symptom:
      "The fetch call on line 24 does not handle network failures or non-2xx responses.",
    whyItMatters:
      "Unhandled promise rejections can crash the application or leave it in an inconsistent state.",
    fixPlan: [
      { step: 1, action: "Add try-catch wrapper" },
      { step: 2, action: "Check response.ok before parsing" },
    ],
    evidence: [],
  },
  {
    id: "5",
    severity: "medium",
    category: "performance",
    title: "Inefficient Selector",
    file: "components/Table.tsx",
    line_start: 12,
    line_end: 12,
    rationale: "Selector computes derived state on every render",
    recommendation: "Memoize the selector or use createSelector",
    suggested_patch: null,
    confidence: 0.75,
    symptom:
      "The useSelector hook on line 12 performs an array filter operation on every render.",
    whyItMatters:
      "This causes unnecessary re-renders and can lead to performance issues with large datasets.",
    evidence: [],
  },
  {
    id: "6",
    severity: "low",
    category: "readability",
    title: "Redundant Code Block",
    file: "views/dashboard.tsx",
    line_start: 201,
    line_end: 215,
    rationale: "Duplicate logic that could be extracted",
    recommendation: "Extract common logic into shared utility",
    suggested_patch: null,
    confidence: 0.7,
    symptom:
      "Lines 201-215 contain logic nearly identical to lines 180-194 in the same file.",
    whyItMatters:
      "Duplicated code increases maintenance burden and risk of bugs when one copy is updated but not the other.",
    evidence: [],
  },
];

const severityIcon: Record<TriageSeverity, { icon: string; color: string }> = {
  blocker: { icon: "X", color: "text-[--tui-red]" },
  high: { icon: "!", color: "text-[--tui-yellow]" },
  medium: { icon: "-", color: "text-gray-400" },
  low: { icon: ".", color: "text-gray-500" },
  nit: { icon: ".", color: "text-gray-600" },
};

const severityCounts = (issues: TriageIssue[]) => {
  const counts: Record<TriageSeverity, number> = {
    blocker: 0,
    high: 0,
    medium: 0,
    low: 0,
    nit: 0,
  };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
};

interface IssueListItemProps {
  issue: TriageIssue;
  isSelected: boolean;
  onClick: () => void;
}

function IssueListItem({ issue, isSelected, onClick }: IssueListItemProps) {
  const { icon, color } = severityIcon[issue.severity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-2 py-1 flex items-center cursor-pointer",
        isSelected && "bg-[--tui-blue] text-black font-bold",
        !isSelected && "hover:bg-[--tui-selection] group",
      )}
    >
      <span
        className={cn(
          "mr-2",
          isSelected && "text-black",
          !isSelected && "opacity-0 group-hover:opacity-100",
        )}
      >
        |
      </span>
      <span className={cn("mr-2", isSelected ? "text-black" : color)}>
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="truncate">{issue.title}</span>
        <span
          className={cn(
            "text-[10px]",
            isSelected ? "opacity-80" : "text-gray-500",
          )}
        >
          {issue.file}:{issue.line_start}
        </span>
      </div>
    </button>
  );
}

const SEVERITY_STYLES: Record<
  TriageSeverity,
  { active: string; inactive: string }
> = {
  blocker: {
    active: "bg-[--tui-red] text-black",
    inactive: "text-[--tui-red]",
  },
  high: {
    active: "bg-[--tui-yellow] text-black",
    inactive: "text-[--tui-yellow]",
  },
  medium: { active: "bg-gray-400 text-black", inactive: "text-gray-400" },
  low: { active: "bg-gray-500 text-black", inactive: "text-gray-500" },
  nit: { active: "bg-gray-600 text-black", inactive: "text-gray-600" },
};

const SEVERITY_LABELS: Record<TriageSeverity, string> = {
  blocker: "BLOCKER",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  nit: "NIT",
};

interface SeverityFilterButtonProps {
  severity: TriageSeverity;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

function SeverityFilterButton({
  severity,
  count,
  isActive,
  onClick,
}: SeverityFilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-1.5 text-xs transition-colors",
        isActive
          ? SEVERITY_STYLES[severity].active
          : SEVERITY_STYLES[severity].inactive,
      )}
    >
      [{SEVERITY_LABELS[severity]} {count}]
    </button>
  );
}

interface FixPlanChecklistProps {
  steps: FixPlanStep[];
  completedSteps: Set<number>;
  onToggle: (step: number) => void;
}

function FixPlanChecklist({
  steps,
  completedSteps,
  onToggle,
}: FixPlanChecklistProps) {
  return (
    <div className="space-y-1 text-sm">
      {steps.map((step) => {
        const isComplete = completedSteps.has(step.step);
        return (
          <button
            type="button"
            key={step.step}
            className="flex gap-2 cursor-pointer w-full text-left"
            onClick={() => onToggle(step.step)}
          >
            <span
              className={isComplete ? "text-[--tui-green]" : "text-[--tui-fg]"}
            >
              [{isComplete ? "x" : " "}]
            </span>
            <span className={isComplete ? "text-gray-400 line-through" : ""}>
              {step.action}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface CodeSnippetProps {
  lines: Array<{ number: number; content: string; highlight?: boolean }>;
}

function CodeSnippet({ lines }: CodeSnippetProps) {
  return (
    <div className="bg-black border border-[--tui-border] p-2 font-mono text-xs text-gray-400">
      {lines.map((line) => (
        <div key={line.number} className="flex">
          <span className="w-6 text-gray-600 border-r border-gray-700 mr-2 text-right pr-1">
            {line.number}
          </span>
          <span className={line.highlight ? "text-[--tui-red]" : ""}>
            {line.content}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReviewPage() {
  const navigate = useNavigate();
  const [selectedIssueIndex, setSelectedIssueIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [focusPane, setFocusPane] = useState<FocusPane>("list");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set([1]),
  );

  const filteredIssues =
    severityFilter === "all"
      ? MOCK_ISSUES
      : MOCK_ISSUES.filter((i) => i.severity === severityFilter);

  // Clamp index during render (derived state) instead of via effect
  const safeIndex =
    filteredIssues.length > 0
      ? Math.min(selectedIssueIndex, filteredIssues.length - 1)
      : 0;
  const selectedIssue = filteredIssues[safeIndex] ?? null;
  const counts = severityCounts(MOCK_ISSUES);

  useScope("review");
  useKey("Escape", () => navigate({ to: "/" }), { enabled: focusPane === "list" });
  useKey("j", () => setSelectedIssueIndex((i) => Math.min(i + 1, filteredIssues.length - 1)), { enabled: focusPane === "list" });
  useKey("ArrowDown", () => setSelectedIssueIndex((i) => Math.min(i + 1, filteredIssues.length - 1)), { enabled: focusPane === "list" });
  useKey("k", () => setSelectedIssueIndex((i) => Math.max(i - 1, 0)), { enabled: focusPane === "list" });
  useKey("ArrowUp", () => setSelectedIssueIndex((i) => Math.max(i - 1, 0)), { enabled: focusPane === "list" });
  useKey("Tab", () => setFocusPane(focusPane === "list" ? "details" : "list"));
  useKey("1", () => setActiveTab("details"), { enabled: focusPane === "details" });
  useKey("2", () => setActiveTab("explain"), { enabled: focusPane === "details" });
  useKey("3", () => setActiveTab("trace"), { enabled: focusPane === "details" });
  useKey("4", () => setActiveTab("patch"), { enabled: focusPane === "details" && !!selectedIssue?.suggested_patch });

  const handleToggleStep = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  };

  const tabs: Array<{ id: TabId; label: string; show: boolean }> = [
    { id: "details", label: "Details", show: true },
    { id: "explain", label: "Explain", show: true },
    { id: "trace", label: "Trace", show: true },
    { id: "patch", label: "Patch", show: !!selectedIssue?.suggested_patch },
  ];

  const footerShortcuts = [
    { key: "j/k", label: "Select" },
    { key: "Tab", label: "Focus Pane" },
    { key: "1-4", label: "Tab" },
  ];

  const rightShortcuts = [
    { key: "Space", label: "Toggle" },
    { key: "Esc", label: "Back" },
  ];

  return (
    <div className="bg-[--tui-bg] text-[--tui-fg] h-screen flex flex-col overflow-hidden font-mono">
      {/* TODO: providerName should come from props/context */}
      <Header providerName="GPT-4o" providerStatus="active" />

      <div className="flex flex-1 overflow-hidden px-4">
        {/* Left Panel - Issue List */}
        <div
          className={cn(
            "w-2/5 flex flex-col border-r border-[--tui-border] pr-4",
            focusPane === "list" && "ring-1 ring-[--tui-blue] ring-inset",
          )}
        >
          {/* Analysis Run Info */}
          <div className="pb-4 pt-2">
            <div className="text-[--tui-violet] font-bold mb-2">
              Analysis #8821
            </div>
            <div className="flex gap-2 text-xs flex-wrap">
              {(["blocker", "high", "medium", "low"] as const).map((sev) => (
                <SeverityFilterButton
                  key={sev}
                  severity={sev}
                  count={counts[sev]}
                  isActive={severityFilter === sev}
                  onClick={() =>
                    setSeverityFilter((f) => (f === sev ? "all" : sev))
                  }
                />
              ))}
            </div>
          </div>

          {/* Issue List */}
          <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1">
            {filteredIssues.map((issue, index) => (
              <IssueListItem
                key={issue.id}
                issue={issue}
                isSelected={index === safeIndex}
                onClick={() => setSelectedIssueIndex(index)}
              />
            ))}
            {filteredIssues.length === 0 && (
              <div className="text-gray-500 text-sm p-2">
                No issues match filter
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Issue Details */}
        <div
          className={cn(
            "w-3/5 flex flex-col pl-4",
            focusPane === "details" && "ring-1 ring-[--tui-blue] ring-inset",
          )}
        >
          {/* Tab Navigation */}
          <div className="flex border-b border-[--tui-border] pb-2 pt-2 mb-4 text-sm">
            {tabs.map(
              (tab) =>
                tab.show && (
                  <Button
                    key={tab.id}
                    variant="tab"
                    data-active={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="mr-4"
                  >
                    {activeTab === tab.id ? `[${tab.label}]` : tab.label}
                  </Button>
                ),
            )}
          </div>

          {/* Details Content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide pr-2">
            {selectedIssue ? (
              <>
                {/* Issue Header */}
                <div className="mb-6">
                  <h1
                    className={cn(
                      "text-xl font-bold mb-1",
                      selectedIssue.severity === "blocker" &&
                        "text-[--tui-red]",
                      selectedIssue.severity === "high" &&
                        "text-[--tui-yellow]",
                      selectedIssue.severity === "medium" && "text-gray-300",
                      selectedIssue.severity === "low" && "text-gray-400",
                    )}
                  >
                    {selectedIssue.title}
                  </h1>
                  <div className="text-xs text-gray-500">
                    Location:{" "}
                    <span className="text-[--tui-fg]">
                      src/{selectedIssue.file}:{selectedIssue.line_start}
                    </span>
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === "details" && (
                  <>
                    {/* Symptom Section */}
                    <div className="mb-6">
                      <h3 className="tui-section-heading text-[--tui-blue] font-bold mb-2 uppercase text-xs tracking-wider">
                        SYMPTOM
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-300">
                        {selectedIssue.symptom}
                      </p>
                      {selectedIssue.evidence.length > 0 && (
                        <div className="mt-2">
                          <CodeSnippet
                            lines={[
                              {
                                number: (selectedIssue.line_start ?? 1) - 1,
                                content:
                                  selectedIssue.evidence[0]?.excerpt ?? "",
                              },
                              {
                                number: selectedIssue.line_start ?? 1,
                                content:
                                  "const result = await db.query(query); <-- UNSAFE",
                                highlight: true,
                              },
                            ]}
                          />
                        </div>
                      )}
                    </div>

                    {/* Why It Matters Section */}
                    <div className="mb-6">
                      <h3 className="tui-section-heading text-[--tui-blue] font-bold mb-2 uppercase text-xs tracking-wider">
                        WHY IT MATTERS
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-300">
                        {selectedIssue.whyItMatters}
                      </p>
                      {selectedIssue.category === "security" && (
                        <div className="mt-2 flex gap-2">
                          <span className="border border-[--tui-red] text-[--tui-red] text-[10px] px-1">
                            CWE-89
                          </span>
                          <span className="border border-[--tui-red] text-[--tui-red] text-[10px] px-1">
                            OWASP A03
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Fix Plan Section */}
                    {selectedIssue.fixPlan &&
                      selectedIssue.fixPlan.length > 0 && (
                        <div className="mb-6">
                          <h3 className="tui-section-heading text-[--tui-blue] font-bold mb-2 uppercase text-xs tracking-wider">
                            FIX PLAN
                          </h3>
                          <FixPlanChecklist
                            steps={selectedIssue.fixPlan}
                            completedSteps={completedSteps}
                            onToggle={handleToggleStep}
                          />
                        </div>
                      )}
                  </>
                )}

                {activeTab === "explain" && (
                  <div className="text-sm text-gray-300">
                    <p className="mb-4">{selectedIssue.rationale}</p>
                    <p>{selectedIssue.recommendation}</p>
                  </div>
                )}

                {activeTab === "trace" && (
                  <div className="text-sm text-gray-500 italic">
                    {selectedIssue.trace && selectedIssue.trace.length > 0 ? (
                      <div className="space-y-2">
                        {selectedIssue.trace.map((t) => (
                          <div
                            key={t.step}
                            className="border-l-2 border-[--tui-border] pl-2"
                          >
                            <div className="text-[--tui-fg]">
                              Step {t.step}: {t.tool}
                            </div>
                            <div className="text-gray-500 text-xs">
                              {t.outputSummary}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      "No trace data available for this issue."
                    )}
                  </div>
                )}

                {activeTab === "patch" && selectedIssue.suggested_patch && (
                  <div className="bg-black border border-[--tui-border] p-2 font-mono text-xs">
                    {selectedIssue.suggested_patch
                      .split("\n")
                      .map((line, i) => (
                        <div
                          key={i}
                          className={cn(
                            line.startsWith("-") && "text-[--tui-red]",
                            line.startsWith("+") && "text-[--tui-green]",
                          )}
                        >
                          {line}
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-500 text-center py-8">
                Select an issue to view details
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer shortcuts={footerShortcuts} rightShortcuts={rightShortcuts} />
    </div>
  );
}
