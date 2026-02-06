import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey, useFooterNavigation } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { Panel, PanelHeader, PanelContent } from "@/components/ui/containers";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { useContextManagement } from "@/features/settings/hooks/use-context-management";

const NA = "\u2014";

const FOOTER_SHORTCUTS = [
  { key: "←/→", label: "Navigate" },
  { key: "Enter", label: "Activate" },
  { key: "Esc", label: "Back" },
];

const BUTTON_COUNT = 1;

export function DiagnosticsPage() {
  const navigate = useNavigate();
  const { contextStatus, contextGeneratedAt, handleRefreshContext } = useContextManagement();

  const canDownloadContext = contextStatus === "ready";

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS });

  const handleButtonAction = (_index: number) => {
    if (canDownloadContext) {
      void handleRefreshContext();
    }
  };

  const { focusedIndex, enterFooter } = useFooterNavigation({
    enabled: true,
    buttonCount: BUTTON_COUNT,
    onAction: handleButtonAction,
  });

  useEffect(() => {
    enterFooter(0);
  }, [enterFooter]);

  useKey("Escape", () => navigate({ to: "/settings" }));

  return (
    <div className="flex-1 flex overflow-hidden px-4 justify-center items-center">
      <Panel className="w-full max-w-2xl bg-tui-selection shadow-lg">
        <PanelHeader valueVariant="muted">
          System Diagnostics
        </PanelHeader>

        <PanelContent spacing="none" className="p-6 space-y-8">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
            {/* Version Info */}
            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">
                Version Info
              </span>
              <span className="text-tui-muted">{NA}</span>
            </div>

            {/* Terminal Environment */}
            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">
                Terminal Environment
              </span>
              <span className="text-tui-muted">{NA}</span>
            </div>

            {/* Unicode Support */}
            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">
                Unicode Support
              </span>
              <span className="text-tui-muted">{NA}</span>
            </div>

            {/* Memory Usage */}
            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">
                Memory Usage
              </span>
              <span className="text-tui-muted">{NA}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-tui-border border-dashed" />

          {/* Context Snapshot */}
          <div className="space-y-2">
            <span className="text-tui-muted text-xs uppercase tracking-wider">
              Context Snapshot
            </span>
            <div className="text-sm text-tui-muted">
              {contextStatus === "loading" && "Checking..."}
              {contextStatus === "ready" && contextGeneratedAt && (
                <span>Last generated: {new Date(contextGeneratedAt).toLocaleString()}</span>
              )}
              {contextStatus === "missing" && "Not generated yet. Generate it in Settings \u2192 Analysis."}
              {contextStatus === "error" && "Failed to load context status."}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-tui-border border-dashed" />

          {/* Buttons */}
          <div className="flex gap-4 pt-2">
            <Button
              bracket
              variant="outline"
              disabled={!canDownloadContext}
              className={cn(
                "transition-colors",
                "hover:bg-tui-selection hover:text-white hover:border-tui-green",
                "focus:outline-none focus:ring-1 focus:ring-tui-green",
                focusedIndex === 0 && canDownloadContext && "ring-2 ring-tui-green border-tui-green"
              )}
              onClick={() => void handleRefreshContext()}
            >
              Refresh Context
            </Button>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
