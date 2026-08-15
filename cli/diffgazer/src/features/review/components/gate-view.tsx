import { usePageFooter } from "@diffgazer/core/footer";
import { CONFIGURE_PROVIDER_LABEL } from "@diffgazer/core/review";
import { BACK_SHORTCUTS, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, useInput } from "ink";
import { ErrorGatePanel } from "../../../components/layout/error-gate";
import { Button } from "../../../components/ui/button";
import { useActionRow } from "../../../hooks/use-action-row";

export interface ReviewGateViewProps {
  title: string;
  body: string;
  /** Identity of the affected configuration (provider, model), kept visible through the gate. */
  meta?: string;
  variant: "error" | "warning";
  primaryLabel: string;
  onPrimary: () => void;
  /** Adds a Configure Provider recovery action (button plus `p`) that opens provider settings. */
  onGoToSettings?: () => void;
  onBack: () => void;
  /** False drops the secondary Back button when the primary already goes back; Esc still calls onBack. */
  showBackButton?: boolean;
  disabled?: boolean;
}

const SELECT_SHORTCUT: Shortcut = { key: "Enter", label: "Select" };
const ACTION_SHORTCUTS: Shortcut[] = [{ key: "Left/Right", label: "Actions" }, SELECT_SHORTCUT];
const PROVIDER_ACTION_SHORTCUTS: Shortcut[] = [
  ...ACTION_SHORTCUTS,
  { key: "p", label: "Providers" },
];

export function ReviewGateView({
  title,
  body,
  meta,
  variant,
  primaryLabel,
  onPrimary,
  onGoToSettings,
  onBack,
  showBackButton = true,
  disabled = false,
}: ReviewGateViewProps) {
  const actionCount = 1 + (onGoToSettings ? 1 : 0) + (showBackButton ? 1 : 0);
  const backIndex = showBackButton ? actionCount - 1 : -1;
  const navigationShortcuts = onGoToSettings ? PROVIDER_ACTION_SHORTCUTS : ACTION_SHORTCUTS;
  usePageFooter({
    shortcuts: actionCount > 1 ? navigationShortcuts : [SELECT_SHORTCUT],
    rightShortcuts: BACK_SHORTCUTS,
  });
  const actions = useActionRow({
    actionCount,
    disabledActions: Array.from({ length: actionCount }, () => disabled),
    onAction: (index) => {
      if (index === 0) onPrimary();
      else if (index === backIndex) onBack();
      else onGoToSettings?.();
    },
    isActive: !disabled,
    verticalNavigation: true,
  });

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack();
        return;
      }
      if (input === " ") {
        actions.activate();
        return;
      }
      if (input === "p" && onGoToSettings) onGoToSettings();
    },
    { isActive: !disabled },
  );

  return (
    <Box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <ErrorGatePanel title={title} message={body} meta={meta} variant={variant}>
        <Box gap={2}>
          <Button
            variant="primary"
            isActive={actions.isActionActive(0)}
            onPress={() => actions.activate(0)}
            disabled={disabled}
          >
            {primaryLabel}
          </Button>
          {onGoToSettings ? (
            <Button
              variant="secondary"
              isActive={actions.isActionActive(1)}
              onPress={() => actions.activate(1)}
              disabled={disabled}
            >
              {CONFIGURE_PROVIDER_LABEL}
            </Button>
          ) : null}
          {showBackButton ? (
            <Button
              variant="secondary"
              isActive={actions.isActionActive(backIndex)}
              onPress={() => actions.activate(backIndex)}
              disabled={disabled}
            >
              Back
            </Button>
          ) : null}
        </Box>
      </ErrorGatePanel>
    </Box>
  );
}
