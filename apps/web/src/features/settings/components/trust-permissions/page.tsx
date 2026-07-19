import { TRUST_EDITOR_MESSAGES, useTrustEditor } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import {
  BACK_SHORTCUT,
  NAVIGATE_SHORTCUT,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Panel } from "@diffgazer/ui/components/panel";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";
import { useConfigData } from "@/hooks/use-config";

const SETTINGS_TRUST_PERMISSIONS_SCOPE = "settings-trust-permissions";

export function SettingsTrustPermissionsPage() {
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
  const { capabilities, isTrusted, isLoading, handleCapabilitiesChange, handleSave, handleRevoke } =
    useTrustEditor(editorInput, {
      onSaved: () => {
        toast.success("Saved", { message: TRUST_EDITOR_MESSAGES.saved });
      },
      onRevoked: () => {
        toast.success("Revoked", { message: TRUST_EDITOR_MESSAGES.revoked });
      },
      onError: (message) => {
        toast.error("Error", { message });
      },
    });

  const footerShortcuts: Shortcut[] = [
    NAVIGATE_SHORTCUT,
    { key: "Enter/Space", label: "Toggle / Activate" },
  ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [BACK_SHORTCUT],
  });
  useScope(SETTINGS_TRUST_PERMISSIONS_SCOPE);
  useKey("Escape", () => navigate({ to: "/settings" }), {
    scope: SETTINGS_TRUST_PERMISSIONS_SCOPE,
  });

  return (
    <div className="flex flex-1 overflow-y-auto p-4">
      <Panel className="m-auto w-full max-w-2xl">
        <Panel.Header>
          <Panel.Title>TRUST &amp; PERMISSIONS</Panel.Title>
        </Panel.Header>
        <Panel.Content>
          <TrustPermissionsContent
            directory={editorInput.repoRoot ?? "Loading..."}
            value={capabilities}
            onChange={handleCapabilitiesChange}
            isTrusted={isTrusted}
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
