import { usePageFooter } from "@diffgazer/core/footer";
import { getNoChangesCopy } from "@diffgazer/core/review";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Box, useInput } from "ink";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Panel } from "../../../components/ui/panel";

export interface NoChangesViewProps {
  mode: ReviewMode;
  onSwitchMode: () => void;
  onBack: () => void;
}

const ACTION_SHORTCUTS: Shortcut[] = [
  { key: "Left/Right", label: "Actions" },
  { key: "Enter", label: "Select" },
];
const BACK_SHORTCUTS: Shortcut[] = [{ key: "Esc", label: "Back" }];

export function NoChangesView({ mode, onSwitchMode, onBack }: NoChangesViewProps) {
  const { title, message, switchLabel } = getNoChangesCopy(mode);
  const [buttonIndex, setButtonIndex] = useState(0);
  usePageFooter({ shortcuts: ACTION_SHORTCUTS, rightShortcuts: BACK_SHORTCUTS });

  useInput((_input, key) => {
    if (key.leftArrow || key.upArrow) {
      setButtonIndex(0);
      return;
    }
    if (key.rightArrow || key.downArrow) {
      setButtonIndex(1);
      return;
    }
    if (key.escape) {
      onBack();
    }
  });

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <Callout variant="warning">
            <Callout.Title>{title}</Callout.Title>
            <Callout.Content>{message}</Callout.Content>
          </Callout>
          <Box gap={2}>
            <Button variant="primary" isActive={buttonIndex === 0} onPress={onSwitchMode}>
              {switchLabel}
            </Button>
            <Button variant="secondary" isActive={buttonIndex === 1} onPress={onBack}>
              Back
            </Button>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
