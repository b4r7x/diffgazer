import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { TrustCapabilities } from "@repo/schemas";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useToast } from "@/components/layout";
import { Panel, PanelHeader, PanelContent } from "@/components/ui/panel";
import { TrustPermissionsContent } from "@/components/settings/trust-permissions-content";

const FOOTER_SHORTCUTS = [
  { key: "Space", label: "Toggle" },
  { key: "Enter", label: "Save" },
  { key: "Esc", label: "Back" },
];

export function TrustPermissionsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [capabilities, setCapabilities] = useState<TrustCapabilities>({
    readFiles: true,
    readGit: true,
    runCommands: false,
  });

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS });

  useKey("Escape", () => navigate({ to: "/settings" }));

  const isTrusted = capabilities.readFiles || capabilities.readGit;

  const handleSave = () => {
    console.log("Saving trust settings:", capabilities);
    showToast({
      variant: "success",
      title: "Saved",
      message: "Trust permissions updated"
    });
    navigate({ to: "/settings" });
  };

  const handleRevoke = () => {
    setCapabilities({
      readFiles: false,
      readGit: false,
      runCommands: false,
    });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>TRUST & PERMISSIONS</PanelHeader>
        <PanelContent>
          <TrustPermissionsContent
            directory="~/dev/projects/stargazer"
            value={capabilities}
            onChange={setCapabilities}
            isTrusted={isTrusted}
            showActions
            onSave={handleSave}
            onRevoke={handleRevoke}
          />
        </PanelContent>
      </Panel>
    </div>
  );
}
