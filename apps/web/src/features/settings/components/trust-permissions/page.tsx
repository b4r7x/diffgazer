import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { TrustCapabilities } from "@stargazer/schemas/config";
import { useKey } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useToast, Panel, PanelHeader, PanelContent } from "@stargazer/ui";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";
import { useConfigData } from "@/app/providers/config-provider";
import { useTrust } from "@/hooks/use-trust";

const FOOTER_SHORTCUTS = [
  { key: "Space", label: "Toggle" },
  { key: "Enter", label: "Save" },
  { key: "Esc", label: "Back" },
];

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  runCommands: false,
};

export function TrustPermissionsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { projectId, repoRoot, trust } = useConfigData();
  const { save, revoke, isLoading } = useTrust(projectId);

  const [capabilities, setCapabilities] = useState<TrustCapabilities>(
    () => ({ ...(trust?.capabilities ?? DEFAULT_CAPABILITIES), runCommands: false }),
  );

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS });
  useKey("Escape", () => navigate({ to: "/settings" }));

  async function handleSave(): Promise<void> {
    if (!projectId || !repoRoot) {
      showToast({
        variant: "error",
        title: "Error",
        message: "Project information not available",
      });
      return;
    }

    try {
      await save({
        projectId,
        repoRoot,
        capabilities,
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
      });
      showToast({
        variant: "success",
        title: "Saved",
        message: "Trust permissions updated",
      });
      navigate({ to: "/settings" });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to save trust settings",
      });
    }
  }

  async function handleRevoke(): Promise<void> {
    try {
      await revoke();
      showToast({
        variant: "success",
        title: "Revoked",
        message: "Trust has been revoked for this directory",
      });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to revoke trust",
      });
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
