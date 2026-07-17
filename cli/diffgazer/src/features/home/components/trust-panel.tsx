import { guardQueryState, useInit, useSaveTrust } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import { getTrustButtonLabel } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { TRUST_FOOTER_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { TrustPermissionsContent } from "../../../components/shared/trust-permissions-content";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";

interface TrustPanelProps {
  onAccept: () => void;
}

export function TrustPanel({ onAccept }: TrustPanelProps): ReactElement {
  const initQuery = useInit();
  const saveTrust = useSaveTrust();
  const [capabilities, setCapabilities] = useState<TrustCapabilities>({
    readFiles: true,
    runCommands: false,
  });
  const [buttonActive, setButtonActive] = useState(false);

  const saving = saveTrust.isPending;
  const error = saveTrust.error?.message ?? null;
  const hasRepoAccess = capabilities.readFiles;

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
    if (!initQuery.data) return;
    if (!initQuery.data.project.projectId) return;
    saveTrust.mutate({ capabilities, trustMode: "persistent" }, { onSuccess: () => onAccept() });
  }

  const guard = guardQueryState(initQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading project info..." />
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Text color="red">Error: {err.message}</Text>
        </Panel.Content>
      </Panel>
    ),
  });
  if (guard) return guard;

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Trust This Repository?</SectionHeader>
          <Text dimColor>Diffgazer needs permissions to review your code</Text>

          <Callout variant="warning">
            <Callout.Title>First-Time Setup</Callout.Title>
            <Callout.Content>
              Grant permissions so the AI reviewer can analyze your code. You can change these later
              in Settings.
            </Callout.Content>
          </Callout>

          <TrustPermissionsContent
            directory={initQuery.data?.project.path ?? "Loading..."}
            value={capabilities}
            onChange={setCapabilities}
            isActive={!saving && !buttonActive}
          />

          <Box gap={1}>
            <Button
              variant="success"
              onPress={handleAccept}
              isActive={!saving && buttonActive && !!initQuery.data}
              disabled={saving || !initQuery.data}
            >
              {actionLabel}
            </Button>
          </Box>
          {error && <Text color="red">{error}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
