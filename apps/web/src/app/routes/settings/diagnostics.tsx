import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey, useFooterNavigation } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { Panel, PanelHeader, PanelContent } from "@/components/ui/containers";
import { PathList } from "@/components/ui/path-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import type { SystemDiagnostics } from "@/features/settings/types";
import { api } from "@/lib/api";
import type { ReviewContextResponse } from "@stargazer/api/types";

const DIAGNOSTICS: SystemDiagnostics = {
  version: "v1.4.2",
  nodeVersion: "v20.5.1",
  tty: true,
  terminalSize: "120x40",
  colorSupport: "24-bit",
  unicodeSupport: "Full Support",
  memoryRss: "42MB",
  memoryHeap: "28MB",
  paths: {
    config: "~/.config/stargazer",
    data: "~/.local/share/stargazer/runs",
    cache: "~/.cache/stargazer/v1",
  },
};

const FOOTER_SHORTCUTS = [
  { key: "←/→", label: "Navigate" },
  { key: "Enter", label: "Activate" },
  { key: "Esc", label: "Back" },
];

const BUTTON_COUNT = 4;

export function SettingsDiagnosticsPage() {
  const navigate = useNavigate();
  const [contextSnapshot, setContextSnapshot] = useState<ReviewContextResponse | null>(null);
  const [contextStatus, setContextStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS });

  useEffect(() => {
    let active = true;
    setContextStatus("loading");
    api
      .getReviewContext()
      .then((context) => {
        if (!active) return;
        setContextSnapshot(context);
        setContextStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setContextSnapshot(null);
        setContextStatus("missing");
      });

    return () => {
      active = false;
    };
  }, []);

  const downloadContextSnapshot = useCallback(() => {
    if (!contextSnapshot) return;
    const download = (filename: string, content: string, type: string) => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    };

    download("context.txt", contextSnapshot.text, "text/plain");
    download("context.md", contextSnapshot.markdown, "text/markdown");
    download("context.json", JSON.stringify(contextSnapshot.graph, null, 2), "application/json");
  }, [contextSnapshot]);

  const canDownloadContext = contextStatus === "ready" && !!contextSnapshot;

  const handleButtonAction = useCallback((index: number) => {
    switch (index) {
      case 0:
        break;
      case 1:
        if (canDownloadContext) {
          downloadContextSnapshot();
        }
        break;
      case 2:
        break;
      case 3:
        break;
    }
  }, [downloadContextSnapshot, canDownloadContext]);

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
      <Panel className="w-full max-w-2xl bg-[#161b22] shadow-lg">
        <PanelHeader value={DIAGNOSTICS.version} valueVariant="muted">
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
              <div className="flex items-center gap-2">
                <span className="text-tui-blue">Stargazer {DIAGNOSTICS.version}</span>
                <span className="text-tui-border">|</span>
                <span className="text-tui-green">Node {DIAGNOSTICS.nodeVersion}</span>
              </div>
            </div>

            {/* Terminal Environment */}
            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">
                Terminal Environment
              </span>
              <div className="flex items-center gap-2">
                <span>
                  TTY <span className="text-tui-green">[{DIAGNOSTICS.tty ? "Yes" : "No"}]</span>
                </span>
                <span className="text-tui-border">|</span>
                <span>{DIAGNOSTICS.terminalSize}</span>
                <span className="text-tui-border">|</span>
                <span>
                  Color <span className="text-tui-violet">[{DIAGNOSTICS.colorSupport}]</span>
                </span>
              </div>
            </div>

            {/* Unicode Support */}
            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">
                Unicode Support
              </span>
              <div className="text-white flex items-center gap-2">
                <span>[{DIAGNOSTICS.unicodeSupport}]</span>
                <span className="text-xs text-tui-yellow">✔ ✖ ▲ ●</span>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">
                Memory Usage
              </span>
              <div className="text-white">
                RSS: {DIAGNOSTICS.memoryRss} / Heap: {DIAGNOSTICS.memoryHeap}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-tui-border border-dashed" />

          {/* Storage Paths */}
          <PathList
            title="Storage Paths"
            paths={{
              Config: DIAGNOSTICS.paths.config,
              Data: DIAGNOSTICS.paths.data,
              Cache: DIAGNOSTICS.paths.cache,
            }}
          />

          {/* Divider */}
          <div className="border-t border-tui-border border-dashed" />

          {/* Buttons */}
          <div className="flex gap-4 pt-2">
            <Button
              bracket
              variant="outline"
              className={cn(
                "transition-colors",
                "hover:bg-tui-selection hover:text-white hover:border-tui-blue",
                "focus:outline-none focus:ring-1 focus:ring-tui-blue",
                focusedIndex === 0 && "ring-2 ring-tui-blue border-tui-blue"
              )}
            >
              Print Paths
            </Button>
            <Button
              bracket
              variant="outline"
              disabled={!canDownloadContext}
              className={cn(
                "transition-colors",
                "hover:bg-tui-selection hover:text-white hover:border-tui-green",
                "focus:outline-none focus:ring-1 focus:ring-tui-green",
                focusedIndex === 1 && canDownloadContext && "ring-2 ring-tui-green border-tui-green"
              )}
            >
              Download Context
            </Button>
            <Button
              bracket
              variant="outline"
              className={cn(
                "transition-colors",
                "hover:bg-tui-selection hover:text-white hover:border-tui-green",
                "focus:outline-none focus:ring-1 focus:ring-tui-green",
                focusedIndex === 2 && "ring-2 ring-tui-green border-tui-green"
              )}
            >
              Export Debug Report
            </Button>
            <Button
              bracket
              variant="outline"
              className={cn(
                "ml-auto transition-colors",
                "hover:bg-tui-selection hover:text-tui-red hover:border-tui-red",
                "focus:outline-none focus:ring-1 focus:ring-tui-red",
                focusedIndex === 3 && "ring-2 ring-tui-red border-tui-red text-tui-red"
              )}
            >
              Reset UI Settings
            </Button>
          </div>
          {contextStatus === "missing" && (
            <div className="text-xs text-tui-muted font-mono">
              Context snapshot not available. Run a review or generate it in Settings → Analysis.
            </div>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
