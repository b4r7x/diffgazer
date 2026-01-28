import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey } from "@/hooks/keyboard";
import { useRouteState } from "@/hooks/use-route-state";
import { useFooter } from "@/components/layout";
import { Panel, PanelHeader, PanelContent } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Credential {
  id: string;
  provider: string;
  status: "active" | "expired" | "invalid";
  lastUsed: string;
  maskedKey: string;
}

const CREDENTIALS: Credential[] = [
  {
    id: "1",
    provider: "Gemini",
    status: "active",
    lastUsed: "2 hours ago",
    maskedKey: "AIza...Xk9m",
  },
  {
    id: "2",
    provider: "OpenAI",
    status: "active",
    lastUsed: "1 day ago",
    maskedKey: "sk-...j8Kp",
  },
];

function getStatusBadge(status: Credential["status"]) {
  switch (status) {
    case "active":
      return (
        <span className="text-xs font-medium text-[--tui-green]">[active]</span>
      );
    case "expired":
      return (
        <span className="text-xs text-[--tui-yellow]">[expired]</span>
      );
    case "invalid":
      return <span className="text-xs text-[--tui-red]">[invalid]</span>;
  }
}

const FOOTER_SHORTCUTS = [
  { key: "Up/Down", label: "Select" },
  { key: "Enter", label: "Edit" },
  { key: "Esc", label: "Back" },
];

export function SettingsCredentialsPage() {
  const navigate = useNavigate();
  const { setShortcuts, setRightShortcuts } = useFooter();
  const [credentials] = useState<Credential[]>(CREDENTIALS);
  const [selectedIndex, setSelectedIndex] = useRouteState('selectedIndex', 0);

  useKey("Escape", () => navigate({ to: "/settings" }));

  const rightShortcuts = useMemo(
    () => [{ key: "", label: `${credentials.length} Active` }],
    [credentials.length]
  );

  useEffect(() => {
    setShortcuts(FOOTER_SHORTCUTS);
    setRightShortcuts(rightShortcuts);
  }, [rightShortcuts, setShortcuts, setRightShortcuts]);

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-1/3 flex flex-col border-r border-[--tui-border]">
        <div className="p-3 border-b border-[--tui-border] bg-[--tui-selection]/30">
          <h2 className="text-sm font-bold text-[--tui-fg] uppercase tracking-wide">
            API Keys
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {credentials.map((cred, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                type="button"
                key={cred.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  "w-full px-3 py-2 flex justify-between items-center cursor-pointer transition-colors text-left",
                  isSelected && "bg-[--tui-blue] text-black",
                  !isSelected &&
                    "text-gray-400 hover:bg-[--tui-selection] hover:text-[--tui-fg]"
                )}
              >
                <span className={cn("font-mono", isSelected && "font-bold")}>
                  {cred.provider}
                </span>
                {getStatusBadge(cred.status)}
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-[--tui-border]">
          <Button variant="secondary" size="sm" className="w-full">
            + Add New Key
          </Button>
        </div>
      </div>

      <div className="w-2/3 flex flex-col">
        <Panel className="flex-1">
          <PanelHeader>KEY DETAILS</PanelHeader>
          <PanelContent className="space-y-6">
            {credentials[selectedIndex] && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs uppercase">
                      Provider
                    </span>
                    <p className="text-[--tui-fg] font-mono">
                      {credentials[selectedIndex].provider}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs uppercase">
                      Status
                    </span>
                    <p>{getStatusBadge(credentials[selectedIndex].status)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs uppercase">
                      API Key
                    </span>
                    <p className="text-[--tui-fg] font-mono">
                      {credentials[selectedIndex].maskedKey}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs uppercase">
                      Last Used
                    </span>
                    <p className="text-[--tui-fg]">
                      {credentials[selectedIndex].lastUsed}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-[--tui-border]" />

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">
                    Rotate Key
                  </Button>
                  <Button variant="destructive" size="sm">
                    Revoke
                  </Button>
                </div>
              </>
            )}
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
