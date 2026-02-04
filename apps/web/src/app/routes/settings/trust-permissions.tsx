import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { TrustCapabilities } from "@/types/config";
import { Panel, PanelContent, PanelHeader } from "@/components/ui";
import { TrustPermissionsContent } from "@/components/settings";
import { useConfigContext } from "@/app/providers/config-provider";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { SETTINGS_SHORTCUTS } from "@/lib/navigation";

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: false,
  readGit: false,
  runCommands: false,
};

export function TrustPermissionsPage() {
  const navigate = useNavigate();
  const { trust, repoRoot, isLoading } = useConfigContext();

  const [capabilities, setCapabilities] = useState<TrustCapabilities>(
    trust?.capabilities ?? DEFAULT_CAPABILITIES
  );

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });
  useKey("Escape", () => navigate({ to: "/settings" }));

  const directory = repoRoot ?? "Unknown directory";
  const isTrusted = trust !== null;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>Trust &amp; Permissions</PanelHeader>
        <PanelContent>
          {isLoading ? (
            <p className="text-gray-500">Loading trust settings...</p>
          ) : (
            <TrustPermissionsContent
              directory={directory}
              value={capabilities}
              onChange={setCapabilities}
              isTrusted={isTrusted}
            />
          )}
          {!isTrusted && !isLoading && (
            <p className="text-gray-500 text-sm mt-4">
              This project is not currently trusted. Trust settings are managed via the CLI.
            </p>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
