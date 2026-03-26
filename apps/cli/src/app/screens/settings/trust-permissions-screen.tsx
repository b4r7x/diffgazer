import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useSettingsZone } from "../../../hooks/use-settings-zone.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useInit, useSaveTrust, useDeleteTrust, matchQueryState } from "@diffgazer/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Button } from "../../../components/ui/button.js";
import { TrustPermissionsContent } from "../../../features/settings/components/trust-permissions-content.js";

interface Capabilities {
  readFiles: boolean;
  runCommands: boolean;
}

export function TrustPermissionsScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
  useScope("trust-form");
  usePageFooter({
    shortcuts: [
      { key: "Esc", label: "Back" },
      { key: "Tab", label: "Switch zone" },
      { key: "↑↓", label: "Navigate" },
      { key: "Space", label: "Toggle" },
    ],
  });
  useBackHandler();

  const initQuery = useInit();
  const saveTrust = useSaveTrust();
  const deleteTrust = useDeleteTrust();

  const trust = initQuery.data?.project.trust ?? null;
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const saving = saveTrust.isPending || deleteTrust.isPending;
  const saveError = saveTrust.error?.message ?? deleteTrust.error?.message ?? null;

  const effectiveCapabilities: Capabilities = capabilities ?? trust?.capabilities ?? {
    readFiles: false,
    runCommands: false,
  };

  const { isListActive, isButtonActive } = useSettingsZone({
    buttonCount: 2,
    disabled: saving,
  });

  function handleSave() {
    if (!initQuery.data) return;
    setSaveMessage(null);
    saveTrust.mutate({
      projectId: initQuery.data.project.projectId,
      repoRoot: initQuery.data.project.path,
      capabilities: effectiveCapabilities,
      trustMode: trust?.trustMode ?? "persistent",
      trustedAt: new Date().toISOString(),
    }, {
      onSuccess: () => {
        setSaveMessage("Trust permissions saved.");
        setCapabilities(null);
      },
    });
  }

  function handleRevoke() {
    if (!initQuery.data) return;
    setSaveMessage(null);
    deleteTrust.mutate(initQuery.data.project.projectId, {
      onSuccess: () => {
        setCapabilities(null);
        setSaveMessage("Trust permissions revoked.");
      },
    });
  }

  const guard = matchQueryState(initQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading trust permissions..." />
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
    success: () => null,
  });
  if (guard) return guard as ReactElement;

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 60)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader>Trust & Permissions</SectionHeader>
              <TrustPermissionsContent
                capabilities={effectiveCapabilities}
                onChange={setCapabilities}
                isActive={isListActive}
              />
              <Box gap={1}>
                <Button variant="primary" onPress={handleSave} disabled={saving} isActive={isButtonActive(0)}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="destructive" onPress={handleRevoke} disabled={saving} isActive={isButtonActive(1)}>
                  Revoke All
                </Button>
              </Box>
              {saveMessage && <Text color="green">{saveMessage}</Text>}
              {saveError && <Text color="red">{saveError}</Text>}
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
