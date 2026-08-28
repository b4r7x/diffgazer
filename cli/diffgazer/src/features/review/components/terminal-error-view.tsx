import { usePageFooter } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { BACK_SHORTCUTS, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, useInput } from "ink";
import type { ReactElement } from "react";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { useActionRow } from "../../../hooks/use-action-row";
import {
  getProviderRecoveryLine,
  getProviderRecoveryShortcut,
  PROVIDER_RECOVERY_KEY,
} from "../lib/provider-recovery";
import { ACTION_SHORTCUTS } from "./gate-view";

/** The one key both the running advisory and the dead run publish for the picker. */
const FILTER_FILES_KEY = "f";
const FILTER_FILES_LABEL = "Review Specific Files";

export function ReviewTerminalErrorView({
  title,
  error,
  guidance,
  onBack,
  recovery,
  onFilterFiles,
}: {
  title: string;
  error: string;
  guidance?: string;
  onBack: () => void;
  /** Set when the failure is fixed on the providers screen; adds the `p` recovery shortcut, named by the CTA. */
  recovery?: { label: string; open: () => void };
  /**
   * Set for a run that actually reached the diff. A dead review offers Back and
   * nothing else; this is the second move — start again over fewer files —
   * which is the stated remedy when the diff did not fit the model's window,
   * and never claims to repair the failure it sits under.
   */
  onFilterFiles?: () => void;
}): ReactElement {
  const filterShortcut: Shortcut = { key: FILTER_FILES_KEY, label: FILTER_FILES_LABEL };
  usePageFooter({
    shortcuts:
      recovery || onFilterFiles
        ? [
            ...ACTION_SHORTCUTS,
            ...(recovery ? [getProviderRecoveryShortcut(recovery.label)] : []),
            ...(onFilterFiles ? [filterShortcut] : []),
          ]
        : [],
    rightShortcuts: BACK_SHORTCUTS,
  });
  // The row is built left to right — recovery, then the picker, then Back.
  const recoveryCount = recovery ? 1 : 0;
  const filterCount = onFilterFiles ? 1 : 0;
  const actionCount = recoveryCount + filterCount + 1;
  // Each button owns its own Enter; the row owns Left/Right and the single mark.
  const actions = useActionRow({ actionCount });
  useInput(
    (input, key) => {
      if (key.escape) {
        onBack();
      } else if (input === PROVIDER_RECOVERY_KEY && recovery) {
        recovery.open();
      } else if (input === FILTER_FILES_KEY && onFilterFiles) {
        onFilterFiles();
      }
    },
    { isActive: true },
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Callout variant="error">
        <Callout.Title>{title}</Callout.Title>
        <Callout.Content>{sanitizeTerminalText(error)}</Callout.Content>
        {guidance ? <Callout.Content>{guidance}</Callout.Content> : null}
        {recovery ? (
          <Callout.Content>{getProviderRecoveryLine(recovery.label)}</Callout.Content>
        ) : null}
        {onFilterFiles ? (
          <Callout.Content>{`Press ${FILTER_FILES_KEY} — ${FILTER_FILES_LABEL}.`}</Callout.Content>
        ) : null}
      </Callout>
      <Box gap={2}>
        {recovery ? (
          <Button variant="secondary" isActive={actions.isActionActive(0)} onPress={recovery.open}>
            {recovery.label}
          </Button>
        ) : null}
        {onFilterFiles ? (
          <Button
            variant="secondary"
            isActive={actions.isActionActive(recoveryCount)}
            onPress={onFilterFiles}
          >
            {FILTER_FILES_LABEL}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          isActive={actions.isActionActive(actionCount - 1)}
          onPress={onBack}
        >
          Back
        </Button>
      </Box>
    </Box>
  );
}
