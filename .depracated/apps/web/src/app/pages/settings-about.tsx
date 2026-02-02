"use client";

import { useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey, useFooterNavigation } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { Panel, PanelHeader, PanelContent } from "@/components/ui/containers";
import { cn } from "@/lib/utils";

const DIAGNOSTICS = {
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

const BUTTON_COUNT = 3;

export function SettingsAboutPage() {
  const navigate = useNavigate();

  const footerShortcuts = useMemo(() => FOOTER_SHORTCUTS, []);
  usePageFooter({ shortcuts: footerShortcuts });

  const handleButtonAction = useCallback((index: number) => {
    switch (index) {
      case 0:
        console.log("Paths:", DIAGNOSTICS.paths);
        break;
      case 1:
        console.log("Debug report exported");
        break;
      case 2:
        console.log("UI settings reset");
        break;
    }
  }, []);

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
            <div className="space-y-3">
              <h3 className="text-tui-violet font-bold text-xs uppercase tracking-wider">
                Storage Paths
              </h3>
              <div className="grid grid-cols-[80px_1fr] gap-2 text-sm font-mono">
                <span className="text-tui-muted text-right">Config:</span>
                <span className="text-tui-fg">{DIAGNOSTICS.paths.config}</span>
                <span className="text-tui-muted text-right">Data:</span>
                <span className="text-tui-fg">{DIAGNOSTICS.paths.data}</span>
                <span className="text-tui-muted text-right">Cache:</span>
                <span className="text-tui-fg">{DIAGNOSTICS.paths.cache}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-tui-border border-dashed" />

            {/* Buttons */}
            <div className="flex gap-4 pt-2">
              <button
                className={cn(
                  "bg-tui-bg border border-tui-border text-tui-fg px-3 py-1.5 text-sm transition-colors",
                  "hover:bg-tui-selection hover:text-white hover:border-tui-blue",
                  "focus:outline-none focus:ring-1 focus:ring-tui-blue",
                  focusedIndex === 0 && "ring-2 ring-tui-blue border-tui-blue"
                )}
              >
                [ Print Paths ]
              </button>
              <button
                className={cn(
                  "bg-tui-bg border border-tui-border text-tui-fg px-3 py-1.5 text-sm transition-colors",
                  "hover:bg-tui-selection hover:text-white hover:border-tui-green",
                  "focus:outline-none focus:ring-1 focus:ring-tui-green",
                  focusedIndex === 1 && "ring-2 ring-tui-green border-tui-green"
                )}
              >
                [ Export Debug Report ]
              </button>
              <button
                className={cn(
                  "bg-tui-bg border border-tui-border text-tui-fg px-3 py-1.5 text-sm transition-colors ml-auto",
                  "hover:bg-tui-selection hover:text-tui-red hover:border-tui-red",
                  "focus:outline-none focus:ring-1 focus:ring-tui-red",
                  focusedIndex === 2 && "ring-2 ring-tui-red border-tui-red text-tui-red"
                )}
              >
                [ Reset UI Settings ]
              </button>
            </div>
          </PanelContent>
        </Panel>
    </div>
  );
}
