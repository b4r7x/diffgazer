import { usePageFooter } from "@diffgazer/core/footer";
import { getApiKeyMissingCopy, sanitizeTerminalText } from "@diffgazer/core/review";
import type { SetupStatus } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, useInput } from "ink";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Panel } from "../../../components/ui/panel";

export interface ApiKeyMissingViewProps {
  provider?: string;
  missing: Readonly<SetupStatus["missing"]>;
  onGoToSettings: () => void;
  onBack: () => void;
}

export interface ConfigurationErrorViewProps {
  error: string;
  onRetry: () => void;
  onBack: () => void;
}

interface ReviewGateViewProps {
  title: string;
  body: string;
  variant: "error" | "warning";
  primaryLabel: string;
  onPrimary: () => void;
  onBack: () => void;
}

const ACTION_SHORTCUTS: Shortcut[] = [
  { key: "Left/Right", label: "Actions" },
  { key: "Enter", label: "Select" },
];
const BACK_SHORTCUTS: Shortcut[] = [{ key: "Esc", label: "Back" }];

export function ApiKeyMissingView({
  provider,
  missing,
  onGoToSettings,
  onBack,
}: ApiKeyMissingViewProps) {
  const { title, body } = getApiKeyMissingCopy({ provider, missing });

  return (
    <ReviewGateView
      title={title}
      body={body}
      variant="warning"
      primaryLabel="Go to Settings"
      onPrimary={onGoToSettings}
      onBack={onBack}
    />
  );
}

export function ConfigurationErrorView({ error, onRetry, onBack }: ConfigurationErrorViewProps) {
  return (
    <ReviewGateView
      title="Configuration Unavailable"
      body={`Diffgazer could not load the current configuration. ${sanitizeTerminalText(error)}`}
      variant="error"
      primaryLabel="Retry"
      onPrimary={onRetry}
      onBack={onBack}
    />
  );
}

function ReviewGateView({
  title,
  body,
  variant,
  primaryLabel,
  onPrimary,
  onBack,
}: ReviewGateViewProps) {
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
          <Callout variant={variant}>
            <Callout.Title>{title}</Callout.Title>
            <Callout.Content>{body}</Callout.Content>
          </Callout>
          <Box gap={2}>
            <Button variant="primary" isActive={buttonIndex === 0} onPress={onPrimary}>
              {primaryLabel}
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
