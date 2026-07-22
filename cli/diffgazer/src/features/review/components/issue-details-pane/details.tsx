import { type IssueDetailsPresentation, sanitizeTerminalText } from "@diffgazer/core/review";
import { SEVERITY_LABELS } from "@diffgazer/core/schemas/presentation";
import { type ReviewIssue, toEvidencePresentation } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import { Badge } from "../../../../components/ui/badge";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import { SectionHeader } from "../../../../components/ui/section-header";
import { useTheme } from "../../../../theme/provider";
import { severityColor } from "../../../../theme/severity";
import { CodeSnippet } from "../code-snippet";
import { FixPlanChecklist } from "../fix-plan-checklist";

export function DetailsTab({
  issue,
  completedSteps,
  onToggleStep,
  subZone,
  scrollHeight,
  isActive,
  presentation,
}: {
  issue: ReviewIssue;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
  subZone: "body" | "fix-plan";
  scrollHeight: number;
  isActive: boolean;
  presentation: IssueDetailsPresentation;
}) {
  const { tokens } = useTheme();
  const evidence = issue.evidence.map((item, ordinal) =>
    toEvidencePresentation(item, issue.file, ordinal),
  );
  const isFixPlanActive = subZone === "fix-plan";

  return (
    <ScrollArea
      height={scrollHeight}
      isActive={isActive}
      autoTail={isFixPlanActive}
      contentIdentity={`${issue.id}:${subZone}`}
    >
      <Box flexDirection="column" gap={1} paddingTop={1}>
        <Box gap={1}>
          <Badge color={severityColor(issue.severity, tokens)} dot>
            {SEVERITY_LABELS[issue.severity]}
          </Badge>
          <Badge variant="neutral">{presentation.category}</Badge>
          <Text color={tokens.muted}>confidence: {presentation.confidence}</Text>
        </Box>

        <SectionHeader variant="muted">Symptom</SectionHeader>
        <Text color={tokens.fg}>{sanitizeTerminalText(issue.symptom)}</Text>

        {evidence.length > 0 ? (
          <Box flexDirection="column" gap={1}>
            <SectionHeader variant="muted">Evidence</SectionHeader>
            {evidence.map((item) =>
              item.kind === "code" ? (
                <Box key={`${item.type}:${item.ordinal}`} flexDirection="column">
                  <CodeSnippet
                    filePath={item.file}
                    startLine={item.startLine}
                    code={item.excerpt}
                  />
                </Box>
              ) : (
                <Box key={`${item.type}:${item.ordinal}`} flexDirection="column" paddingLeft={1}>
                  <Box gap={1}>
                    <Text color={tokens.muted}>{sanitizeTerminalText(item.label)}:</Text>
                    <Text color={tokens.fg} bold>
                      {sanitizeTerminalText(item.title)}
                    </Text>
                  </Box>
                  <Text color={tokens.fg}>
                    <Text color={tokens.muted}>source: </Text>
                    {sanitizeTerminalText(item.sourceText)}
                  </Text>
                  <Text color={tokens.fg}>{sanitizeTerminalText(item.excerpt)}</Text>
                </Box>
              ),
            )}
          </Box>
        ) : null}

        <SectionHeader variant="muted">Why It Matters</SectionHeader>
        <Text color={tokens.fg}>{sanitizeTerminalText(issue.whyItMatters)}</Text>

        {presentation.fixPlan.length > 0 ? (
          <Box flexDirection="column">
            <SectionHeader variant="muted">Fix Plan</SectionHeader>
            <FixPlanChecklist
              key={issue.id}
              steps={presentation.fixPlan}
              completedSteps={completedSteps}
              onToggle={onToggleStep}
              isActive={isFixPlanActive}
            />
          </Box>
        ) : null}

        {issue.betterOptions && issue.betterOptions.length > 0 ? (
          <Box flexDirection="column">
            <SectionHeader variant="muted">Better Options</SectionHeader>
            {issue.betterOptions.map((opt, index) => (
              <Box
                // biome-ignore lint/suspicious/noArrayIndexKey: option text can repeat; backend order is the rendered identity.
                key={index}
                gap={1}
              >
                <Text color={tokens.muted}>-</Text>
                <Text color={tokens.fg}>{sanitizeTerminalText(opt)}</Text>
              </Box>
            ))}
          </Box>
        ) : null}

        {issue.testsToAdd && issue.testsToAdd.length > 0 ? (
          <Box flexDirection="column">
            <SectionHeader variant="muted">Tests to Add</SectionHeader>
            {issue.testsToAdd.map((test, index) => (
              <Box
                // biome-ignore lint/suspicious/noArrayIndexKey: test text can repeat; backend order is the rendered identity.
                key={index}
                gap={1}
              >
                <Text color={tokens.muted}>-</Text>
                <Text color={tokens.fg}>{sanitizeTerminalText(test)}</Text>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
    </ScrollArea>
  );
}
