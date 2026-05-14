import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import { NO_TRUST_CAPABILITIES } from "@diffgazer/core/schemas/config";
import { getErrorMessage } from "@diffgazer/core/errors";
import {
  useInit,
  useSaveTrust,
  useDeleteTrust,
  guardQueryState,
} from "@diffgazer/core/api/hooks";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useSettingsZone } from "../../../hooks/use-settings-zone.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Button } from "../../../components/ui/button.js";
import { TrustPermissionsContent } from "../../../features/settings/components/trust-permissions-content.js";
import {
  buildSavePayload,
  getInitialDraft,
  resolveEditorView,
  type TrustDraft,
} from "../../../features/settings/trust-permissions/trust-editor-state.js";

const TRUST_FORM_SHORTCUTS = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Tab", label: "Switch zone" },
  { key: "Space", label: "Toggle" },
  { key: "Enter", label: "Activate" },
];

const TRUST_FORM_RIGHT_SHORTCUTS = [{ key: "Esc", label: "Back" }];

export function TrustPermissionsScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
  useScope("trust-form");
  usePageFooter({
    shortcuts: TRUST_FORM_SHORTCUTS,
    rightShortcuts: TRUST_FORM_RIGHT_SHORTCUTS,
  });
  useBackHandler();

  const initQuery = useInit();
  const saveTrust = useSaveTrust();
  const deleteTrust = useDeleteTrust();

  const project = initQuery.data?.project ?? null;
  const trust = project?.trust ?? null;
  const editorInput = {
    projectId: project?.projectId ?? null,
    repoRoot: project?.path ?? null,
    trust,
  };

  const [draft, setDraft] = useState<TrustDraft>(() => getInitialDraft(editorInput));
  const [statusMessage, setStatusMessage] = useState<
    { tone: "success" | "error"; text: string } | null
  >(null);

  const view = resolveEditorView(draft, editorInput);
  if (draft.editorKey !== view.editorKey) {
    setDraft({ editorKey: view.editorKey, capabilities: view.capabilities });
  }

  const isLoading = saveTrust.isPending || deleteTrust.isPending;
  const { isListActive, isButtonActive } = useSettingsZone({
    buttonCount: 2,
    disabled: isLoading,
  });

  function handleCapabilitiesChange(next: TrustCapabilities) {
    setDraft({ editorKey: view.editorKey, capabilities: next });
  }

  function handleSave() {
    if (isLoading) return;
    const result = buildSavePayload({
      ...editorInput,
      capabilities: view.capabilities,
      now: () => new Date(),
    });
    if (result.kind === "blocked") {
      setStatusMessage({ tone: "error", text: "Project information not available" });
      return;
    }
    setStatusMessage(null);
    saveTrust.mutate(result.payload, {
      onSuccess: () => {
        setStatusMessage({ tone: "success", text: "Trust permissions updated" });
      },
      onError: (error: Error) => {
        setStatusMessage({
          tone: "error",
          text: getErrorMessage(error, "Failed to save trust settings"),
        });
      },
    });
  }

  function handleRevoke() {
    if (isLoading || !editorInput.projectId) return;
    setStatusMessage(null);
    deleteTrust.mutate(editorInput.projectId, {
      onSuccess: () => {
        setDraft({ editorKey: view.editorKey, capabilities: NO_TRUST_CAPABILITIES });
        setStatusMessage({ tone: "success", text: "Trust has been revoked for this directory" });
      },
      onError: (error: Error) => {
        setStatusMessage({
          tone: "error",
          text: getErrorMessage(error, "Failed to revoke trust"),
        });
      },
    });
  }

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

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 72)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader>Trust &amp; Permissions</SectionHeader>
              <TrustPermissionsContent
                directory={editorInput.repoRoot ?? "Loading..."}
                value={view.capabilities}
                onChange={handleCapabilitiesChange}
                isTrusted={view.isTrusted}
                isActive={isListActive}
              />
              <Box justifyContent="flex-end" gap={1}>
                <Button
                  variant="success"
                  onPress={handleSave}
                  disabled={isLoading}
                  isActive={isButtonActive(0)}
                >
                  {saveTrust.isPending ? "[ Saving... ]" : "[ Save Changes ]"}
                </Button>
                <Button
                  variant="destructive"
                  onPress={handleRevoke}
                  disabled={isLoading}
                  isActive={isButtonActive(1)}
                >
                  {deleteTrust.isPending ? "[ Revoking... ]" : "[ Revoke Trust ]"}
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
