import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useInit, useSaveTrust, useDeleteTrust } from "@diffgazer/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { TrustPermissionsContent } from "../../../features/settings/components/trust-permissions-content.js";

interface Capabilities {
  readFiles: boolean;
  runCommands: boolean;
}

export function TrustPermissionsScreen(): ReactElement {
  useScope("trust-form");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Space", label: "Toggle" }] });
  useBackHandler();

  const { data: initData, isLoading: initLoading, error: initErrorObj } = useInit();
  const initError = initErrorObj?.message ?? null;

  const saveTrust = useSaveTrust();
  const deleteTrust = useDeleteTrust();

  const trust = initData?.project.trust ?? null;
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const saving = saveTrust.isPending || deleteTrust.isPending;
  const saveError = saveTrust.error?.message ?? deleteTrust.error?.message ?? null;

  // Derive effective capabilities: local edits take priority, then server trust, then defaults
  const effectiveCapabilities: Capabilities = capabilities ?? trust?.capabilities ?? {
    readFiles: false,
    runCommands: false,
  };

  function handleSave() {
    if (!initData) return;
    setSaveMessage(null);
    saveTrust.mutate({
      projectId: initData.project.projectId,
      repoRoot: initData.project.path,
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
    if (!initData) return;
    setSaveMessage(null);
    deleteTrust.mutate(initData.project.projectId, {
      onSuccess: () => {
        setCapabilities(null);
        setSaveMessage("Trust permissions revoked.");
      },
    });
  }

  if (initLoading) {
    return (
      <Panel>
        <Panel.Content>
          <Box gap={1}>
            <Spinner type="dots" />
            <Text>Loading trust permissions...</Text>
          </Box>
        </Panel.Content>
      </Panel>
    );
  }

  if (initError) {
    return (
      <Panel>
        <Panel.Content>
          <Text color="red">Error: {initError}</Text>
        </Panel.Content>
      </Panel>
    );
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Trust & Permissions</SectionHeader>
          <TrustPermissionsContent
            capabilities={effectiveCapabilities}
            onChange={setCapabilities}
            isActive={!saving}
          />
          <Box gap={1}>
            <Button variant="primary" onPress={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="destructive" onPress={handleRevoke} disabled={saving}>
              Revoke All
            </Button>
          </Box>
          {saveMessage && <Text color="green">{saveMessage}</Text>}
          {saveError && <Text color="red">{saveError}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
