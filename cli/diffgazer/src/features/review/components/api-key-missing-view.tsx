import { usePageFooter } from "@diffgazer/core/footer";
import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  getApiKeyMissingCopy,
} from "@diffgazer/core/review";
import type { SetupStatus } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, useInput } from "ink";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Panel } from "../../../components/ui/panel";
import { useActionRow } from "../../../hooks/use-action-row";

export interface ApiKeyMissingViewProps {
  provider?: string;
  missing: Readonly<SetupStatus["missing"]>;
  onGoToSettings: () => void;
  onBack: () => void;
}

export interface ConfigurationErrorViewProps {
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
  disabled?: boolean;
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
      primaryLabel={CONFIGURE_PROVIDER_LABEL}
      onPrimary={onGoToSettings}
      onBack={onBack}
    />
  );
}

export function ConfigurationErrorView({ onRetry, onBack }: ConfigurationErrorViewProps) {
  return (
    <ReviewGateView
      title={CONFIGURATION_ERROR_COPY.title}
      body={CONFIGURATION_ERROR_COPY.body}
      variant="error"
      primaryLabel="Retry"
      onPrimary={onRetry}
      onBack={onBack}
    />
  );
}

export function ReviewGateView({
  title,
  body,
  variant,
  primaryLabel,
  onPrimary,
  onBack,
  disabled = false,
}: ReviewGateViewProps) {
  usePageFooter({ shortcuts: ACTION_SHORTCUTS, rightShortcuts: BACK_SHORTCUTS });
  const actions = useActionRow({
    actionCount: 2,
    disabledActions: [disabled, disabled],
    onAction: (index) => (index === 0 ? onPrimary() : onBack()),
    isActive: !disabled,
    verticalNavigation: true,
  });

  useInput(
    (_input, key) => {
      if (key.escape) onBack();
    },
    { isActive: !disabled },
  );

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <Callout variant={variant}>
            <Callout.Title>{title}</Callout.Title>
            <Callout.Content>{body}</Callout.Content>
          </Callout>
          <Box gap={2}>
            <Button
              variant="primary"
              isActive={actions.isActionActive(0)}
              onPress={() => actions.activate(0)}
              disabled={disabled}
            >
              {primaryLabel}
            </Button>
            <Button
              variant="secondary"
              isActive={actions.isActionActive(1)}
              onPress={() => actions.activate(1)}
              disabled={disabled}
            >
              Back
            </Button>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
