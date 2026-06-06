import { useDeleteTrust, useSaveTrust } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import type { TrustCapabilities, TrustConfig } from "@diffgazer/core/schemas/config";
import { NO_TRUST_CAPABILITIES, normalizeTrustCapabilities } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Panel } from "@diffgazer/ui/components/panel";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useConfigData } from "@/app/providers/config";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";

const SETTINGS_TRUST_PERMISSIONS_SCOPE = "settings-trust-permissions";

function getDraftCapabilities(trust: TrustConfig | null): TrustCapabilities {
  return normalizeTrustCapabilities(trust?.capabilities);
}

function getTrustEditorKey(projectId: string | null, repoRoot: string | null, trust: TrustConfig | null): string {
  if (trust) return `${trust.projectId}:${trust.trustedAt}`;
  return `${projectId ?? "loading"}:${repoRoot ?? "loading"}:untrusted`;
}

export function TrustPermissionsPage() {
  const { projectId, repoRoot, trust } = useConfigData();
  const editorKey = getTrustEditorKey(projectId, repoRoot, trust);

  return (
    <TrustPermissionsEditor
      editorKey={editorKey}
      projectId={projectId}
      repoRoot={repoRoot}
      trust={trust}
      initialCapabilities={getDraftCapabilities(trust)}
    />
  );
}

interface TrustPermissionsEditorProps {
  editorKey: string;
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
  initialCapabilities: TrustCapabilities;
}

function TrustPermissionsEditor({
  editorKey,
  projectId,
  repoRoot,
  trust,
  initialCapabilities,
}: TrustPermissionsEditorProps) {
  const navigate = useNavigate();
  const saveTrust = useSaveTrust();
  const deleteTrust = useDeleteTrust();
  const isLoading = saveTrust.isPending || deleteTrust.isPending;

  const [draft, setDraft] = useState(() => ({
    editorKey,
    capabilities: initialCapabilities,
  }));

  if (draft.editorKey !== editorKey) {
    setDraft({ editorKey, capabilities: initialCapabilities });
  }

  const capabilities = draft.editorKey === editorKey ? draft.capabilities : initialCapabilities;
  const handleCapabilitiesChange = (nextCapabilities: TrustCapabilities) => {
    setDraft({ editorKey, capabilities: nextCapabilities });
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
    if (!projectId || !repoRoot) {
      toast.error("Error", { message: "Project information not available" });
      return;
    }

    try {
      await saveTrust.mutateAsync({
        projectId,
        repoRoot,
        capabilities,
        trustMode: trust?.trustMode ?? "persistent",
        trustedAt: trust?.trustedAt ?? new Date().toISOString(),
      });
      toast.success("Saved", { message: "Trust permissions updated" });
      navigate({ to: "/settings" });
    } catch (error) {
      toast.error("Error", { message: getErrorMessage(error, "Failed to save trust settings") });
    }
  }

  async function handleRevoke(): Promise<void> {
    if (isLoading || !projectId) return;
    try {
      await deleteTrust.mutateAsync(projectId);
      setDraft({ editorKey, capabilities: NO_TRUST_CAPABILITIES });
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
            directory={repoRoot ?? "Loading..."}
            value={capabilities}
            onChange={handleCapabilitiesChange}
            isTrusted={Boolean(trust?.capabilities.readFiles)}
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
