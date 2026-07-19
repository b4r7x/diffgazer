import { guardQueryState, useInit, useSaveTrust } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import {
  DEFAULT_TRUST_PROMPT_CAPABILITIES,
  getTrustButtonLabel,
} from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { TRUST_FOOTER_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useQueryGuardPanels } from "../../../components/shared/query-guard-panels";
import { TrustPermissionsContent } from "../../../components/shared/trust-permissions-content";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";

interface TrustPanelProps {
  onAccept: () => void;
}

export function TrustPanel({ onAccept }: TrustPanelProps): ReactElement {
  const { tokens } = useTheme();
  const { rows } = useTerminalDimensions();
  const initQuery = useInit();
  const saveTrust = useSaveTrust();
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(
    DEFAULT_TRUST_PROMPT_CAPABILITIES,
  );
  const [buttonActive, setButtonActive] = useState(false);

  const saving = saveTrust.isPending;
  const error = saveTrust.error?.message ?? null;
  const hasRepoAccess = capabilities.readFiles;
  const compact = rows <= 24;

  const actionLabel = getTrustButtonLabel(saving, hasRepoAccess);
  const actionShortcuts: Shortcut[] = [
    { key: "Tab", label: "Focus Permissions", disabled: saving },
    { key: "Enter", label: actionLabel, disabled: saving },
    { key: "q", label: "Quit" },
  ];

  usePageFooter({
    shortcuts: buttonActive ? actionShortcuts : TRUST_FOOTER_SHORTCUTS,
  });

  useInput(
    (_input, key) => {
      if (saving) return;
      if (key.tab) {
        setButtonActive((active) => !active);
      }
    },
    { isActive: !saving },
  );

  function handleAccept() {
    saveTrust.mutate({ capabilities, trustMode: "persistent" }, { onSuccess: () => onAccept() });
  }

  const queryGuardPanels = useQueryGuardPanels("Loading project info...");
  const guard = guardQueryState(initQuery, queryGuardPanels);
  if (guard) return guard;

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Trust This Repository?</SectionHeader>
          <Text dimColor>Diffgazer needs permissions to review your code</Text>

          <TrustPermissionsContent
            directory={initQuery.data?.project.path ?? "Loading..."}
            value={capabilities}
            onChange={setCapabilities}
            isActive={!saving && !buttonActive}
            compact={compact}
          />

          <Box gap={1}>
            <Button
              variant="success"
              onPress={handleAccept}
              isActive={!saving && buttonActive}
              disabled={saving}
            >
              {actionLabel}
            </Button>
          </Box>
          {error && <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
