import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useInit } from "../../../hooks/use-init.js";
import { api } from "../../../lib/api.js";
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

  const { data: initData, isLoading: initLoading, error: initError } = useInit();

  const trust = initData?.project.trust ?? null;
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Derive effective capabilities: local edits take priority, then server trust, then defaults
  const effectiveCapabilities: Capabilities = capabilities ?? trust?.capabilities ?? {
    readFiles: false,
    runCommands: false,
  };

  async function handleSave() {
    if (!initData) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await api.saveTrust({
        projectId: initData.project.projectId,
        repoRoot: initData.project.path,
        capabilities: effectiveCapabilities,
        trustMode: trust?.trustMode ?? "persistent",
        trustedAt: new Date().toISOString(),
      });
      setSaveMessage("Trust permissions saved.");
      setCapabilities(null); // reset local edits so next render uses server data
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save trust permissions");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    if (!initData) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await api.deleteTrust(initData.project.projectId);
      setCapabilities(null);
      setSaveMessage("Trust permissions revoked.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to revoke trust permissions");
    } finally {
      setSaving(false);
    }
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
