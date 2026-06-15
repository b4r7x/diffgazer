import {
  guardQueryState,
  TRUST_EDITOR_MESSAGES,
  useInit,
  useTrustEditor,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUT, NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { TrustPermissionsContent } from "../../../components/shared/trust-permissions-content";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useSettingsZone } from "../hooks/use-settings-zone.js";

const TRUST_FORM_SHORTCUTS = [
  NAVIGATE_SHORTCUT,
  { key: "Tab", label: "Switch Zone" },
  { key: "Space", label: "Toggle" },
  { key: "Enter", label: "Activate" },
];

const TRUST_FORM_RIGHT_SHORTCUTS = [BACK_SHORTCUT];

export function TrustPermissionsScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
  usePageFooter({
    shortcuts: TRUST_FORM_SHORTCUTS,
    rightShortcuts: TRUST_FORM_RIGHT_SHORTCUTS,
  });
  useBackHandler();

  const initQuery = useInit();
  const project = initQuery.data?.project ?? null;
  const trust = project?.trust ?? null;
  const editorInput = {
    projectId: project?.projectId ?? null,
    repoRoot: project?.path ?? null,
    trust,
  };

  const guard = guardQueryState(initQuery, {
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
  });
  if (guard) return guard;

  return <LoadedTrustPermissionsScreen columns={columns} editorInput={editorInput} />;
}

interface LoadedTrustPermissionsScreenProps {
  columns: number;
  editorInput: Parameters<typeof useTrustEditor>[0];
}

function LoadedTrustPermissionsScreen({
  columns,
  editorInput,
}: LoadedTrustPermissionsScreenProps): ReactElement {
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const {
    capabilities,
    isTrusted,
    isLoading,
    isSaving,
    isRevoking,
    handleCapabilitiesChange,
    handleSave,
    handleRevoke,
  } = useTrustEditor(editorInput, {
    onSaved: () => setStatusMessage({ tone: "success", text: TRUST_EDITOR_MESSAGES.saved }),
    onRevoked: () => setStatusMessage({ tone: "success", text: TRUST_EDITOR_MESSAGES.revoked }),
    onError: (text) => setStatusMessage({ tone: "error", text }),
  });

  const { isListActive, isButtonActive } = useSettingsZone({
    buttonCount: 2,
    disabled: isLoading,
  });

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 72)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader>Trust &amp; Permissions</SectionHeader>
              <TrustPermissionsContent
                directory={editorInput.repoRoot ?? "Loading..."}
                value={capabilities}
                onChange={handleCapabilitiesChange}
                isTrusted={isTrusted}
                isActive={isListActive}
              />
              <Box justifyContent="flex-end" gap={1}>
                <Button
                  variant="success"
                  onPress={handleSave}
                  disabled={isLoading}
                  isActive={isButtonActive(0)}
                >
                  {isSaving ? "[ Saving... ]" : "[ Save Changes ]"}
                </Button>
                <Button
                  variant="destructive"
                  onPress={handleRevoke}
                  disabled={isLoading}
                  isActive={isButtonActive(1)}
                >
                  {isRevoking ? "[ Revoking... ]" : "[ Revoke Trust ]"}
                </Button>
              </Box>
              {statusMessage && (
                <Text color={statusMessage.tone === "success" ? "green" : "red"}>
                  {statusMessage.text}
                </Text>
              )}
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
