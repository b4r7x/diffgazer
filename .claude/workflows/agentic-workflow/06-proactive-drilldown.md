# Phase 6: Proactive Drilldown

## Overview

Make the agent proactive - it suggests deeper analysis for important issues instead of waiting for the user to ask.

## Goal

After triage completes:
```
┌─────────────────────────────────────────────────────────────┐
│ 🤖 Agent Notice                                             │
├─────────────────────────────────────────────────────────────┤
│ I found a HIGH severity security issue with 72% confidence. │
│ "SQL Injection Risk" in src/auth.ts                         │
│                                                             │
│ Would you like me to analyze it deeper?                     │
│                                                             │
│ [y] Yes, analyze  [n] No, skip  [a] Analyze all HIGH        │
└─────────────────────────────────────────────────────────────┘
```

---

## Agent 6.1: Drilldown Suggestion Logic

```
subagent_type: "llm-application-dev:ai-engineer"

Task: Add logic to suggest drilldown for important issues.

Location: packages/core/src/review/drilldown-suggester.ts

## Interface

export function shouldSuggestDrilldown(issue: TriageIssue): boolean;
export function getSuggestionReason(issue: TriageIssue): string;
export function getPriorityIssuesForDrilldown(issues: TriageIssue[]): TriageIssue[];

## Criteria for Suggestion

An issue should be suggested for drilldown if ANY of:

1. **High Severity + Low Confidence**
   - severity is "blocker" or "high"
   - AND confidence < 0.8

2. **Security Category**
   - category is "security"
   - (always worth deeper look)

3. **Uncertain Language**
   - rationale contains: "might", "possibly", "could be", "unclear", "may"

4. **Missing Evidence**
   - evidence array is empty or has only 1 item

## Implementation

export function shouldSuggestDrilldown(issue: TriageIssue): boolean {
  // Criterion 1: High severity + low confidence
  const isHighSeverity = issue.severity === "blocker" || issue.severity === "high";
  const isLowConfidence = (issue.confidence ?? 1) < 0.8;
  if (isHighSeverity && isLowConfidence) return true;

  // Criterion 2: Security category
  if (issue.category === "security") return true;

  // Criterion 3: Uncertain language
  const uncertainWords = ["might", "possibly", "could be", "unclear", "may", "potential"];
  const rationaleText = (issue.rationale ?? "").toLowerCase();
  if (uncertainWords.some((word) => rationaleText.includes(word))) return true;

  // Criterion 4: Missing evidence
  const evidenceCount = issue.evidence?.length ?? 0;
  if (isHighSeverity && evidenceCount < 2) return true;

  return false;
}

## Suggestion Reason

export function getSuggestionReason(issue: TriageIssue): string {
  const severity = issue.severity.toUpperCase();
  const confidence = Math.round((issue.confidence ?? 1) * 100);

  if (issue.category === "security") {
    return `This is a ${severity} security issue. Security issues benefit from deeper analysis.`;
  }

  if ((issue.confidence ?? 1) < 0.8) {
    return `This ${severity} issue has ${confidence}% confidence. More context could clarify the risk.`;
  }

  if ((issue.evidence?.length ?? 0) < 2) {
    return `This ${severity} issue needs more supporting evidence.`;
  }

  return `This ${severity} issue may benefit from deeper analysis.`;
}

## Get Priority Issues

export function getPriorityIssuesForDrilldown(
  issues: TriageIssue[]
): TriageIssue[] {
  return issues
    .filter(shouldSuggestDrilldown)
    .sort((a, b) => {
      // Sort by severity (blocker > high > medium > low)
      const severityOrder = { blocker: 0, high: 1, medium: 2, low: 3, nit: 4 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by confidence (lower first)
      return (a.confidence ?? 1) - (b.confidence ?? 1);
    });
}

## Steps

1. Create packages/core/src/review/drilldown-suggester.ts
2. Implement shouldSuggestDrilldown
3. Implement getSuggestionReason
4. Implement getPriorityIssuesForDrilldown
5. Export from packages/core/src/review/index.ts
6. Run: npm run type-check

Output: Drilldown suggestion logic created
```

---

## Agent 6.2: Drilldown Prompt Component

```
subagent_type: "react-component-architect"

Task: Show prompt when agent suggests drilldown.

Location: apps/cli/src/features/review/components/drilldown-prompt.tsx

## Component Interface

interface DrilldownPromptProps {
  issue: TriageIssue;
  reason: string;
  remainingCount: number;
  onAccept: () => void;
  onSkip: () => void;
  onAcceptAll: () => void;
  onSkipAll: () => void;
}

## Layout

┌─────────────────────────────────────────────────────────────┐
│ 🤖 Agent Suggestion                                         │
├─────────────────────────────────────────────────────────────┤
│ This HIGH security issue has 72% confidence.                │
│ More context could clarify the risk.                        │
│                                                             │
│ "SQL Injection Risk"                                        │
│ src/auth.ts:42-55                                           │
│                                                             │
│ Would you like me to analyze it deeper?                     │
│ (2 more issues could benefit from analysis)                 │
│                                                             │
│ [y] Yes  [n] No  [a] All  [s] Skip all                      │
└─────────────────────────────────────────────────────────────┘

## Implementation

import { Box, Text, useInput } from "ink";

export function DrilldownPrompt({
  issue,
  reason,
  remainingCount,
  onAccept,
  onSkip,
  onAcceptAll,
  onSkipAll,
}: DrilldownPromptProps) {
  useInput((input, key) => {
    switch (input.toLowerCase()) {
      case "y":
        onAccept();
        break;
      case "n":
        onSkip();
        break;
      case "a":
        onAcceptAll();
        break;
      case "s":
        onSkipAll();
        break;
    }
    if (key.escape) {
      onSkipAll();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Text color="cyan" bold>🤖 Agent Suggestion</Text>

      {/* Reason */}
      <Box marginTop={1}>
        <Text>{reason}</Text>
      </Box>

      {/* Issue info */}
      <Box marginTop={1} flexDirection="column">
        <Text color="yellow" bold>"{issue.title}"</Text>
        <Text color="gray">
          {issue.file}
          {issue.line_start ? `:${issue.line_start}` : ""}
          {issue.line_end && issue.line_end !== issue.line_start
            ? `-${issue.line_end}`
            : ""}
        </Text>
      </Box>

      {/* Question */}
      <Box marginTop={1}>
        <Text>Would you like me to analyze it deeper?</Text>
      </Box>

      {/* Remaining count */}
      {remainingCount > 0 && (
        <Text color="gray">
          ({remainingCount} more issue{remainingCount !== 1 ? "s" : ""} could benefit from analysis)
        </Text>
      )}

      {/* Options */}
      <Box marginTop={1}>
        <Text>
          <Text color="green">[y]</Text> Yes
          <Text color="red">[n]</Text> No
          <Text color="blue">[a]</Text> All
          <Text color="gray">[s]</Text> Skip all
        </Text>
      </Box>
    </Box>
  );
}

## Steps

1. Create apps/cli/src/features/review/components/drilldown-prompt.tsx
2. Implement keyboard handling with useInput
3. Display issue info and reason
4. Show remaining count
5. Export from index.ts
6. Run: npm run type-check

Output: Drilldown prompt created
```

---

## Agent 6.3: Wire Proactive Drilldown into Review Flow

```
subagent_type: "react-component-architect"

Task: Integrate drilldown suggestion into review flow.

Modify: apps/cli/src/app/views/review-view.tsx

## State Additions

const [pendingDrilldowns, setPendingDrilldowns] = useState<string[]>([]);
const [showDrilldownPrompt, setShowDrilldownPrompt] = useState(false);
const [currentPromptIssueId, setCurrentPromptIssueId] = useState<string | null>(null);
const [drilldownMode, setDrilldownMode] = useState<"prompt" | "processing" | "done">("done");

## After Triage Completes

When triage finishes, check for issues that need drilldown:

useEffect(() => {
  if (triageComplete && issues.length > 0) {
    const priorityIssues = getPriorityIssuesForDrilldown(issues);

    if (priorityIssues.length > 0) {
      setPendingDrilldowns(priorityIssues.map((i) => i.id));
      setCurrentPromptIssueId(priorityIssues[0].id);
      setShowDrilldownPrompt(true);
      setDrilldownMode("prompt");
    }
  }
}, [triageComplete, issues]);

## Prompt Handlers

const handleAcceptDrilldown = async () => {
  if (!currentPromptIssueId) return;

  setDrilldownMode("processing");
  await triggerDrilldown(currentPromptIssueId);

  // Move to next pending
  const remaining = pendingDrilldowns.filter((id) => id !== currentPromptIssueId);
  if (remaining.length > 0) {
    setPendingDrilldowns(remaining);
    setCurrentPromptIssueId(remaining[0]);
    setDrilldownMode("prompt");
  } else {
    setShowDrilldownPrompt(false);
    setDrilldownMode("done");
  }
};

const handleSkipDrilldown = () => {
  const remaining = pendingDrilldowns.filter((id) => id !== currentPromptIssueId);
  if (remaining.length > 0) {
    setPendingDrilldowns(remaining);
    setCurrentPromptIssueId(remaining[0]);
  } else {
    setShowDrilldownPrompt(false);
    setDrilldownMode("done");
  }
};

const handleAcceptAll = async () => {
  setDrilldownMode("processing");

  for (const issueId of pendingDrilldowns) {
    await triggerDrilldown(issueId);
  }

  setPendingDrilldowns([]);
  setShowDrilldownPrompt(false);
  setDrilldownMode("done");
};

const handleSkipAll = () => {
  setPendingDrilldowns([]);
  setShowDrilldownPrompt(false);
  setDrilldownMode("done");
};

## Render Prompt

{showDrilldownPrompt && currentPromptIssueId && drilldownMode === "prompt" && (
  <DrilldownPrompt
    issue={issues.find((i) => i.id === currentPromptIssueId)!}
    reason={getSuggestionReason(issues.find((i) => i.id === currentPromptIssueId)!)}
    remainingCount={pendingDrilldowns.length - 1}
    onAccept={handleAcceptDrilldown}
    onSkip={handleSkipDrilldown}
    onAcceptAll={handleAcceptAll}
    onSkipAll={handleSkipAll}
  />
)}

{drilldownMode === "processing" && (
  <Box>
    <Text color="cyan">
      <Spinner type="dots" /> Analyzing issue...
    </Text>
  </Box>
)}

## Steps

1. Import getPriorityIssuesForDrilldown, getSuggestionReason
2. Add state for pending drilldowns
3. Detect priority issues after triage
4. Implement prompt handlers
5. Render DrilldownPrompt conditionally
6. Run: npm run type-check

Output: Proactive drilldown wired
```

---

## Why This Design

### Post-Triage Prompts

Show prompts after triage (not during) because:
- User can see full list of issues first
- Doesn't interrupt initial scan
- User has context to decide
- Can easily skip all if not interested

### Sequential Prompts

Show one issue at a time instead of a list because:
- Less overwhelming
- Clear action per decision
- Can "Accept All" if confident
- Natural conversation flow

### Priority Sorting

Sort by severity then confidence because:
- Most impactful issues first
- Low confidence issues need attention
- User can skip all after seeing top ones

### No Auto-Drilldown

Don't automatically drilldown on all suggestions because:
- Costs time and API calls
- User might not care about all
- Gives user control
- "Agent asks permission" pattern
