import { usePageFooter } from "@diffgazer/core/footer";
import type { InputMethod } from "@diffgazer/core/onboarding";
import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  buildSetupAcknowledgement,
  buildSetupInput,
  CREDENTIAL_ENV_VARS,
  getSetupLayoutCopy,
  requiresExplicitModelSelection,
  toSetupCredential,
} from "@diffgazer/core/providers";
import { useApiKeyEntry } from "@diffgazer/core/providers/hooks";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type {
  ClientConfigurationInput,
  ReadinessAcknowledgement,
} from "@diffgazer/core/schemas/config";
import {
  BACK_SHORTCUT,
  NAVIGATE_SHORTCUT,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { ApiKeyMethodSelector } from "../../../components/shared/api-key-method-selector";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Spinner } from "../../../components/ui/spinner";
import { getFirstEnabledAction, useActionRow } from "../../../hooks/use-action-row";
import { selectionHue } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;

type SetupZone = "method" | "input" | "acknowledgement" | "actions";

function getSetupZones(needsAcceptance: boolean): SetupZone[] {
  return ["method", ...(needsAcceptance ? (["acknowledgement"] as const) : []), "actions"];
}

const KEY_FIELD_SHORTCUT: Shortcut = { key: "Tab", label: "Focus Key Field" };
const LEAVE_FIELD_SHORTCUT: Shortcut = { key: "↑/↓", label: "Leave Field" };
const SELECT_METHOD_SHORTCUT: Shortcut = { key: "Space", label: "Select Method" };
const SWITCH_ACTION_SHORTCUT: Shortcut = { key: "←/→", label: "Switch Action" };
const CONFIRM_SHORTCUT: Shortcut = { key: "Enter", label: "Confirm" };
const ACCEPT_SHORTCUT: Shortcut = { key: "a", label: "Accept" };
const SETUP_RIGHT_SHORTCUTS: Shortcut[] = [{ ...BACK_SHORTCUT, label: "Close" }];

function getSetupShortcuts(
  zone: SetupZone,
  needsAcceptance: boolean,
  method: InputMethod,
): Shortcut[] {
  if (zone === "input") {
    return [LEAVE_FIELD_SHORTCUT, CONFIRM_SHORTCUT];
  }
  return [
    ...(method === "paste" ? [KEY_FIELD_SHORTCUT] : []),
    NAVIGATE_SHORTCUT,
    ...(zone === "method" ? [SELECT_METHOD_SHORTCUT] : []),
    ...(zone === "actions" ? [SWITCH_ACTION_SHORTCUT] : []),
    CONFIRM_SHORTCUT,
    ...(needsAcceptance ? [ACCEPT_SHORTCUT] : []),
  ];
}

interface ApiKeyOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProviderListRow;
  onCreate: (
    input: ClientConfigurationInput,
    opts: {
      acknowledgement: AcceptedAcknowledgement;
      openModelDialog?: boolean;
    },
  ) => Promise<void>;
  onUpdate: (
    input: {
      input: ClientConfigurationInput;
      acknowledgement: AcceptedAcknowledgement;
    },
    opts?: { openModelDialog?: boolean },
  ) => Promise<void>;
}

export function ApiKeyOverlay({
  open,
  onOpenChange,
  row,
  onCreate,
  onUpdate,
}: ApiKeyOverlayProps): ReactElement | null {
  const { tokens } = useTheme();
  const [zone, setZone] = useState<SetupZone>("method");
  // The provider consent is gated before this overlay opens and covers every
  // product notice; an explicit acceptance is asked for only when this
  // product's notice needs accepting again (a notice bump, or a record upgraded
  // without an acceptance).
  const needsAcceptance = row.readiness.acknowledgement.status === "required";
  const [accepted, setAccepted] = useState(false);
  const acknowledged = !needsAcceptance || accepted;
  const isUpdating = row.configuration != null;

  const entry = useApiKeyEntry({
    onSubmit: async (method, value) => {
      if (!acknowledged) return false;
      const input = buildSetupInput(row, toSetupCredential(method, value));
      const acknowledgement = buildSetupAcknowledgement(row);
      const openModelDialog = requiresExplicitModelSelection(row.product.productId);
      if (row.configuration) {
        await onUpdate({ input, acknowledgement }, { openModelDialog });
      } else {
        await onCreate(input, { acknowledgement, openModelDialog });
      }
      onOpenChange(false);
      return true;
    },
  });

  const { method, value, setMethod, setValue, canSubmit, isSubmitting: saving, error } = entry;
  const [methodHighlight, setMethodHighlight] = useState<InputMethod>("paste");
  const canConfirm = canSubmit && acknowledged;
  const zones = getSetupZones(needsAcceptance);
  const disabledActions = [!canConfirm, false];

  function selectMethod(next: InputMethod) {
    setMethod(next);
    setMethodHighlight(next);
  }

  function enterActions() {
    actions.reset(getFirstEnabledAction(disabledActions.length, disabledActions));
    setZone("actions");
  }

  function moveZone(direction: 1 | -1) {
    const current = zone === "input" ? "method" : zone;
    const next = zones[zones.indexOf(current) + direction];
    if (next === undefined) return;
    if (next === "actions") {
      enterActions();
      return;
    }
    if (next === "method" && direction === -1) {
      if (method === "paste") {
        setZone("input");
      } else {
        setZone("method");
        setMethodHighlight("env");
      }
      return;
    }
    setZone(next);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  function handleClose() {
    handleOpenChange(false);
  }

  function handleSave() {
    if (!canConfirm || saving) return;
    void entry.submit();
  }

  useInput(
    (input) => {
      if (input === "a" || (zone === "acknowledgement" && input === " ")) {
        setAccepted((current) => !current);
      }
    },
    { isActive: open && !saving && zone !== "input" && needsAcceptance },
  );

  useInput(
    (input, key) => {
      if (key.tab && method === "paste") {
        setZone(zone === "input" ? "method" : "input");
        return;
      }
      if (input === " " && zone === "method") {
        selectMethod(methodHighlight);
        return;
      }
      if (key.upArrow) {
        if (zone === "input") {
          setZone("method");
          setMethodHighlight("env");
        } else if (zone === "method" && methodHighlight === "env") {
          setMethodHighlight("paste");
        } else if (zone === "acknowledgement") {
          moveZone(-1);
        }
        return;
      }
      if (key.downArrow) {
        if (zone === "input") {
          moveZone(1);
        } else if (zone === "method" && methodHighlight === "paste") {
          setMethodHighlight("env");
        } else if (zone === "method" && method === "paste") {
          setZone("input");
        } else if (zone === "method" || zone === "acknowledgement") {
          moveZone(1);
        }
        return;
      }
      if (key.return && zone !== "actions") handleSave();
    },
    { isActive: open && !saving },
  );

  usePageFooter({
    shortcuts: getSetupShortcuts(zone, needsAcceptance, method),
    rightShortcuts: SETUP_RIGHT_SHORTCUTS,
  });

  const actions = useActionRow({
    actionCount: disabledActions.length,
    disabledActions,
    onAction: (index) => (index === 0 ? handleSave() : handleClose()),
    isActive: open && !saving && zone === "actions",
    verticalNavigation: true,
    onExitUp: () => moveZone(-1),
  });

  const resetSecrets = useEffectEvent(() => {
    if (entry.isSubmitting) return;
    entry.reset();
    actions.reset();
    setZone("method");
    setMethodHighlight("paste");
    setAccepted(false);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: open/row identity are reset triggers.
  useEffect(() => {
    resetSecrets();
  }, [open, row.product.productId, row.configuration?.configurationId]);

  const title = isUpdating ? "Update Configuration" : "Create Configuration";
  const layoutCopy = getSetupLayoutCopy(row);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{`${title} — ${row.product.name}`}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Box flexDirection="column" gap={1}>
            <Text color={tokens.muted}>{layoutCopy}</Text>
            <ApiKeyMethodSelector
              method={method}
              highlightedMethod={zone === "method" || zone === "input" ? methodHighlight : null}
              onMethodChange={selectMethod}
              apiKey={value}
              onApiKeyChange={setValue}
              envVar={CREDENTIAL_ENV_VARS[row.product.productId]}
              isActive={open && !saving && zone === "input"}
              inputFocused={zone === "input"}
              onInputFocusedChange={(focused) => setZone(focused ? "input" : "method")}
            />
            <Box flexDirection="column">
              {[...row.product.notice.billing, ...row.product.notice.privacy].map((line) => (
                <Text key={line} color={tokens.muted}>
                  {line}
                </Text>
              ))}
            </Box>
            {needsAcceptance ? (
              <>
                <Text>This product's notice needs your acceptance before saving.</Text>
                <Text
                  color={zone === "acknowledgement" ? selectionHue(tokens) : tokens.muted}
                  bold={zone === "acknowledgement"}
                >
                  {accepted ? "[x]" : "[ ]"} I accept
                </Text>
              </>
            ) : null}
            {error != null ? <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text> : null}
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Box gap={1}>
            {saving ? (
              <Spinner label="Saving..." />
            ) : (
              <>
                <Button
                  variant="primary"
                  onPress={() => actions.activate(0)}
                  isActive={actions.isActionActive(0)}
                  disabled={!canConfirm}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => actions.activate(1)}
                  isActive={actions.isActionActive(1)}
                >
                  Cancel
                </Button>
              </>
            )}
          </Box>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
