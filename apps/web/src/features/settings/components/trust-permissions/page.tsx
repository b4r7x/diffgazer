import { useDeleteTrust, useSaveTrust } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import type { TrustCapabilities, TrustConfig, TrustDraft } from "@diffgazer/core/schemas/config";
import {
  buildSavePayload,
  getInitialDraft,
  NO_TRUST_CAPABILITIES,
  resolveEditorView,
} from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Panel } from "@diffgazer/ui/components/panel";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";
import { useConfigData } from "@/hooks/use-config";

const SETTINGS_TRUST_PERMISSIONS_SCOPE = "settings-trust-permissions";

export function TrustPermissionsPage() {
  const { projectId, repoRoot, trust } = useConfigData();

  return <TrustPermissionsEditor editorInput={{ projectId, repoRoot, trust }} />;
}

interface TrustPermissionsEditorProps {
  editorInput: {
    projectId: string | null;
    repoRoot: string | null;
    trust: TrustConfig | null;
  };
}

function TrustPermissionsEditor({ editorInput }: TrustPermissionsEditorProps) {
  const navigate = useNavigate();
  const saveTrust = useSaveTrust();
  const deleteTrust = useDeleteTrust();
  const isLoading = saveTrust.isPending || deleteTrust.isPending;
  const [draft, setDraft] = useState<TrustDraft>(() => getInitialDraft(editorInput));
  const view = resolveEditorView(draft, editorInput);

  useEffect(() => {
    if (draft.editorKey === view.editorKey) return;
    setDraft({ editorKey: view.editorKey, capabilities: view.capabilities });
  }, [draft.editorKey, view.editorKey, view.capabilities]);

  const handleCapabilitiesChange = (nextCapabilities: TrustCapabilities) => {
    setDraft({ editorKey: view.editorKey, capabilities: nextCapabilities });
  };

  const footerShortcuts: Shortcut[] = [
    { key: "↑/↓", label: "Navigate" },
    { key: "Enter/Space", label: "Toggle / Activate" },
  ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });
  useScope(SETTINGS_TRUST_PERMISSIONS_SCOPE);
  useKey("Escape", () => navigate({ to: "/settings" }), {
    scope: SETTINGS_TRUST_PERMISSIONS_SCOPE,
  });

  async function handleSave(): Promise<void> {
    if (isLoading) return;
    const result = buildSavePayload({
      ...editorInput,
      capabilities: view.capabilities,
      now: () => new Date(),
    });
    if (result.kind === "blocked") {
      toast.error("Error", { message: "Project information not available" });
      return;
    }

    try {
      await saveTrust.mutateAsync(result.payload);
      toast.success("Saved", { message: "Trust permissions updated" });
      navigate({ to: "/settings" });
    } catch (error) {
      toast.error("Error", { message: getErrorMessage(error, "Failed to save trust settings") });
    }
  }

  async function handleRevoke(): Promise<void> {
    const { projectId } = editorInput;
    if (isLoading || !projectId) return;
    try {
      await deleteTrust.mutateAsync(projectId);
      setDraft({ editorKey: view.editorKey, capabilities: NO_TRUST_CAPABILITIES });
      toast.success("Revoked", { message: "Trust has been revoked for this directory" });
    } catch (error) {
      toast.error("Error", { message: getErrorMessage(error, "Failed to revoke trust") });
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Panel className="w-full max-w-2xl">
        <Panel.Header>
          <Panel.Title>TRUST &amp; PERMISSIONS</Panel.Title>
        </Panel.Header>
        <Panel.Content>
          <TrustPermissionsContent
            directory={editorInput.repoRoot ?? "Loading..."}
            value={view.capabilities}
            onChange={handleCapabilitiesChange}
            isTrusted={view.isTrusted}
            isLoading={isLoading}
            autoFocusList
            showActions
            keyboardScope={SETTINGS_TRUST_PERMISSIONS_SCOPE}
            onSave={handleSave}
            onRevoke={handleRevoke}
          />
        </Panel.Content>
      </Panel>
    </div>
  );
}
