import type { ProviderConsentGate } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import {
  describeAcceptedProviderConsent,
  PROVIDER_CONSENT_NOTICE,
  PROVIDER_CONSENT_PRIVACY_URL,
  PROVIDER_CONSENT_TEXT,
} from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useActionRow } from "../../hooks/use-action-row";
import { useTheme } from "../../theme/provider";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Spinner } from "../ui/spinner";

const ACCEPT_SHORTCUTS: Shortcut[] = [
  { key: "←/→", label: "Switch Action" },
  { key: "Enter", label: PROVIDER_CONSENT_NOTICE.accept },
];
const NOT_NOW_SHORTCUTS: Shortcut[] = [{ ...BACK_SHORTCUT, label: PROVIDER_CONSENT_NOTICE.notNow }];
const CLOSE_SHORTCUTS: Shortcut[] = [{ ...BACK_SHORTCUT, label: PROVIDER_CONSENT_NOTICE.close }];

interface ProviderConsentOverlayProps {
  /** The screen's gate; the overlay shows while it is open and answers to it. */
  gate: ProviderConsentGate;
}

/**
 * The one provider consent as a full-screen confirm, at the same touchpoints
 * the web notice gates: Enter accepts and continues, Escape declines and leaves
 * the screen as it was. Once accepted it reads the notice back with its date.
 */
export function ProviderConsentOverlay({ gate }: ProviderConsentOverlayProps): ReactElement {
  const { isOpen: open, readBack, continues, isAccepting, error } = gate;
  const { tokens } = useTheme();
  const readOnly = readBack !== null;

  usePageFooter({
    shortcuts: readOnly ? [] : ACCEPT_SHORTCUTS,
    rightShortcuts: readOnly ? CLOSE_SHORTCUTS : NOT_NOW_SHORTCUTS,
  });

  const actions = useActionRow({
    actionCount: 2,
    onAction: (index) => (index === 0 ? gate.accept() : gate.decline()),
    isActive: open && !readOnly && !isAccepting,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) gate.decline();
      }}
      // Escape while the acceptance is being saved: the notice holds.
      onEscapeKeyDown={() => isAccepting}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{PROVIDER_CONSENT_NOTICE.title}</Dialog.Title>
          <Dialog.Subtitle>
            {readBack
              ? describeAcceptedProviderConsent(readBack)
              : PROVIDER_CONSENT_NOTICE.askedOnce}
          </Dialog.Subtitle>
        </Dialog.Header>
        <Dialog.Body>
          <Box flexDirection="column" gap={1} marginTop={1}>
            <Text>{PROVIDER_CONSENT_TEXT}</Text>
            <Text color={tokens.muted}>Privacy notes: {PROVIDER_CONSENT_PRIVACY_URL}</Text>
            {error != null ? <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text> : null}
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          {readOnly ? (
            <Button variant="secondary" isActive onPress={gate.decline}>
              {PROVIDER_CONSENT_NOTICE.close}
            </Button>
          ) : (
            <Box gap={1}>
              {isAccepting ? (
                <Spinner label="Saving..." />
              ) : (
                <>
                  <Button
                    variant="primary"
                    isActive={actions.isActionActive(0)}
                    onPress={() => actions.activate(0)}
                  >
                    {continues
                      ? PROVIDER_CONSENT_NOTICE.acceptAndContinue
                      : PROVIDER_CONSENT_NOTICE.accept}
                  </Button>
                  <Button
                    variant="ghost"
                    isActive={actions.isActionActive(1)}
                    onPress={() => actions.activate(1)}
                  >
                    {PROVIDER_CONSENT_NOTICE.notNow}
                  </Button>
                </>
              )}
            </Box>
          )}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
