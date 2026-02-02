import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { TrustCapabilities } from "@repo/schemas";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useToast } from "@/components/layout";
import { Panel, PanelHeader, PanelContent } from "@/components/ui/containers";
import { TrustPermissionsContent } from "@/components/settings/trust-permissions-content";
import { useConfig, useTrust } from "@/features/settings";

const FOOTER_SHORTCUTS = [
  { key: "Space", label: "Toggle" },
  { key: "Enter", label: "Save" },
  { key: "Esc", label: "Back" },
];

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  readGit: true,
  runCommands: false,
};

export function TrustPermissionsPage(): JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { projectId, repoRoot, trust, refresh } = useConfig();
  const { save, revoke, isLoading } = useTrust(projectId);
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(
    () => trust?.capabilities ?? DEFAULT_CAPABILITIES
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
      await refresh(true);
      showToast({
        variant: "success",
        title: "Saved",
        message: "Trust permissions updated",
      });
      navigate({ to: "/settings" });
    } catch {
      showToast({
        variant: "error",
        title: "Error",
        message: "Failed to save trust settings",
      });
    }
  }

  async function handleRevoke(): Promise<void> {
    try {
      await revoke();
      await refresh(true);
      showToast({
        variant: "success",
        title: "Revoked",
        message: "Trust has been revoked for this directory",
      });
    } catch {
      showToast({
        variant: "error",
        title: "Error",
        message: "Failed to revoke trust",
      });
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>TRUST & PERMISSIONS</PanelHeader>
        <PanelContent>
          <TrustPermissionsContent
            directory={repoRoot ?? "Loading..."}
            value={capabilities}
            onChange={setCapabilities}
            isTrusted={trust !== null}
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
