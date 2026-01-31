import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageIssue, FixPlanStep } from "@repo/schemas/triage";

const RISK_COLORS: Record<string, string> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

interface SectionProps {
  title: string;
  content: string;
  color?: string;
}

function Section({ title, content, color }: SectionProps): ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={color}>
        {title}
      </Text>
      <Box marginLeft={2} marginTop={0}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
}

function FixPlanDisplay({ steps }: { steps: FixPlanStep[] }): ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="green">
        Fix Plan
      </Text>
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {steps.map((step) => (
          <Box key={step.step} flexDirection="column" marginBottom={1}>
            <Box flexDirection="row" gap={1}>
              <Text>{step.step}.</Text>
              <Text wrap="wrap">{step.action}</Text>
              {step.risk && (
                <Text color={RISK_COLORS[step.risk]}>
                  ({step.risk} risk)
                </Text>
              )}
            </Box>
            {step.files && step.files.length > 0 && (
              <Box marginLeft={3}>
                <Text dimColor>Files: {step.files.join(", ")}</Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function BetterOptionsDisplay({ options }: { options: string[] }): ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        Better Options
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        {options.map((option) => (
          <Text key={option}>- {option}</Text>
        ))}
      </Box>
    </Box>
  );
}

function TestsToAddDisplay({ tests }: { tests: string[] }): ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="magenta">
        Tests to Add
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        {tests.map((test) => (
          <Text key={test}>- {test}</Text>
        ))}
      </Box>
    </Box>
  );
}

interface IssueBodyDetailsProps {
  issue: TriageIssue;
}

export function IssueBodyDetails({
  issue,
}: IssueBodyDetailsProps): ReactElement {
  return (
    <Box flexDirection="column">
      <Section title="Symptom" content={issue.symptom} color="yellow" />

      <Section title="Why It Matters" content={issue.whyItMatters} color="red" />

      <Section title="Rationale" content={issue.rationale} />

      <Section title="Recommendation" content={issue.recommendation} color="green" />

      {issue.fixPlan && issue.fixPlan.length > 0 && (
        <FixPlanDisplay steps={issue.fixPlan} />
      )}

      {issue.betterOptions && issue.betterOptions.length > 0 && (
        <BetterOptionsDisplay options={issue.betterOptions} />
      )}

      {issue.testsToAdd && issue.testsToAdd.length > 0 && (
        <TestsToAddDisplay tests={issue.testsToAdd} />
      )}
    </Box>
  );
}
