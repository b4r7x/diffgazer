import { Box } from "ink";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Callout } from "../../../components/ui/callout.js";
import { Button } from "../../../components/ui/button.js";
import { Panel } from "../../../components/ui/panel.js";

export interface NoChangesViewProps {
  mode: ReviewMode;
  onSwitchMode: () => void;
  onBack: () => void;
}

const MESSAGES: Record<ReviewMode, { title: string; body: string; switchLabel: string }> = {
  staged: {
    title: "No Staged Changes",
    body: "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead.",
    switchLabel: "Review Unstaged",
  },
  unstaged: {
    title: "No Unstaged Changes",
    body: "No unstaged changes found. Make some edits first, or review staged changes instead.",
    switchLabel: "Review Staged",
  },
  files: {
    title: "No Changes in Selected Files",
    body: "No changes found in the selected files. Make some edits first, or select different files.",
    switchLabel: "Review Unstaged",
  },
};

export function NoChangesView({ mode, onSwitchMode, onBack }: NoChangesViewProps) {
  const { title, body, switchLabel } = MESSAGES[mode];

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <Callout variant="warning">
            <Callout.Title>{title}</Callout.Title>
            <Callout.Content>{body}</Callout.Content>
          </Callout>
          <Box gap={2}>
            <Button variant="primary" isActive onPress={onSwitchMode}>
              {switchLabel}
            </Button>
            <Button variant="secondary" onPress={onBack}>
              Back
            </Button>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
