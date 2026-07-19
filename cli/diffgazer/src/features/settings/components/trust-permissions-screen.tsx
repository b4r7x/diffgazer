import {
  guardQueryState,
  TRUST_EDITOR_MESSAGES,
  useInit,
  useTrustEditor,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useQueryGuardPanels } from "../../../components/shared/query-guard-panels";
import { TrustPermissionsContent } from "../../../components/shared/trust-permissions-content";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { getSettingsFooter, useSettingsZone } from "../hooks/use-settings-zone";

const TRUST_FORM_SHORTCUTS: Shortcut[] = [NAVIGATE_SHORTCUT, { key: "Space", label: "Toggle" }];

export function TrustPermissionsScreen(): ReactElement {
  const { columns, rows } = useTerminalDimensions();
  useBackHandler();

  const initQuery = useInit();
  const project = initQuery.data?.project ?? null;
  const trust = project?.trust ?? null;
  const editorInput = {
    projectId: project?.projectId ?? null,
    repoRoot: project?.path ?? null,
    trust,
  };

  const queryGuardPanels = useQueryGuardPanels("Loading trust permissions...");
  const guard = guardQueryState(initQuery, queryGuardPanels);
  if (guard) return guard;

  return <LoadedTrustPermissionsScreen columns={columns} rows={rows} editorInput={editorInput} />;
}

interface LoadedTrustPermissionsScreenProps {
  columns: number;
  rows: number;
  editorInput: Parameters<typeof useTrustEditor>[0];
}

function LoadedTrustPermissionsScreen({
  columns,
  rows,
  editorInput,
}: LoadedTrustPermissionsScreenProps): ReactElement {
  const { tokens } = useTheme();
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

  const { isListActive, isButtonActive, zone, enterButtons } = useSettingsZone({
    buttonCount: 2,
    disabled: isLoading,
  });

  usePageFooter(
    getSettingsFooter({
      zone,
      listShortcuts: TRUST_FORM_SHORTCUTS,
      buttonActionLabel: isButtonActive(0) ? "Save Changes" : "Revoke Trust",
      buttonActionDisabled: isLoading,
    }),
  );

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 72)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={rows <= 24 ? 0 : 1}>
              <SectionHeader>Trust &amp; Permissions</SectionHeader>
              <TrustPermissionsContent
                directory={editorInput.repoRoot ?? "Loading..."}
                value={capabilities}
                onChange={handleCapabilitiesChange}
                isTrusted={isTrusted}
                isActive={isListActive}
                compact={rows <= 24}
                onDownBoundary={enterButtons}
              />
              {statusMessage ? (
                <Text color={statusMessage.tone === "success" ? tokens.success : tokens.error}>
                  {sanitizeTerminalText(statusMessage.text)}
                </Text>
              ) : null}
              <Box justifyContent="flex-end" gap={1}>
                <Button
                  variant="success"
                  onPress={handleSave}
                  disabled={isLoading}
                  isActive={isButtonActive(0)}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="destructive"
                  onPress={handleRevoke}
                  disabled={isLoading}
                  isActive={isButtonActive(1)}
                >
                  {isRevoking ? "Revoking..." : "Revoke Trust"}
                </Button>
              </Box>
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
