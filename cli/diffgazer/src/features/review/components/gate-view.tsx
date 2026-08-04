import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUTS, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, useInput } from "ink";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Panel } from "../../../components/ui/panel";
import { useActionRow } from "../../../hooks/use-action-row";

export interface ReviewGateViewProps {
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
