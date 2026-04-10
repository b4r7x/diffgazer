import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { TrustCapabilities } from "@diffgazer/schemas/config";
import type { Shortcut } from "@diffgazer/schemas/ui";
import { getErrorMessage } from "@diffgazer/core/errors";
import { useKey } from "keyscope";
import { usePageFooter } from "@/hooks/use-page-footer";
import { Panel, PanelHeader, PanelContent } from "diffui/components/panel";
import { toast } from "diffui/components/toast";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";
import { useConfigData } from "@/app/providers/config-provider";
import { useSaveTrust, useDeleteTrust } from "@diffgazer/api/hooks";

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  runCommands: false,
};

export function TrustPermissionsPage() {
  const navigate = useNavigate();
  const { projectId, repoRoot, trust } = useConfigData();
  const saveTrust = useSaveTrust();
  const deleteTrust = useDeleteTrust();
  const isLoading = saveTrust.isPending || deleteTrust.isPending;

  const [capabilities, setCapabilities] = useState<TrustCapabilities>(
    () => ({ ...(trust?.capabilities ?? DEFAULT_CAPABILITIES), runCommands: false }),
  );

  const footerShortcuts: Shortcut[] = [
    { key: "↑/↓", label: "Navigate" },
    { key: "Enter/Space", label: "Toggle / Activate" },
  ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });
  useKey("Escape", () => navigate({ to: "/settings" }));

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
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
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
      toast.success("Revoked", { message: "Trust has been revoked for this directory" });
    } catch (error) {
      toast.error("Error", { message: getErrorMessage(error, "Failed to revoke trust") });
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>TRUST &amp; PERMISSIONS</PanelHeader>
        <PanelContent>
          <TrustPermissionsContent
            directory={repoRoot ?? "Loading..."}
            value={capabilities}
            onChange={setCapabilities}
            isTrusted={Boolean(trust?.capabilities.readFiles)}
            isLoading={isLoading}
            showActions
            onSave={handleSave}
            onRevoke={handleRevoke}
          />
        </PanelContent>
      </Panel>
    </div>
  );
}
