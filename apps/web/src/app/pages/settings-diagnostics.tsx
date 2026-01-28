import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { Button } from "@/components/ui/button";

const DIAGNOSTICS = {
  version: "v2.4.0-nightly",
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
  { key: "Enter", label: "Activate" },
  { key: "Esc", label: "Back" },
];

export function SettingsDiagnosticsPage() {
  const navigate = useNavigate();

  const footerShortcuts = useMemo(() => FOOTER_SHORTCUTS, []);
  usePageFooter({ shortcuts: footerShortcuts });

  useKey("Escape", () => navigate({ to: "/settings" }));

  return (
    <div className="flex-1 overflow-hidden px-4 flex justify-center items-center">
      <div className="w-full max-w-2xl flex flex-col border border-[--tui-border] bg-[#161b22]">
        <div className="bg-[--tui-selection] border-b border-[--tui-border] px-4 py-2 flex justify-between items-center">
          <span className="font-bold text-[--tui-fg]">System Diagnostics</span>
          <span className="text-xs text-gray-500">{DIAGNOSTICS.version}</span>
        </div>

        <div className="p-6 space-y-8">
          <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                Version Info
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[--tui-blue]">
                  Stargazer {DIAGNOSTICS.version}
                </span>
                <span className="text-[--tui-border]">|</span>
                <span className="text-[--tui-green]">
                  Node {DIAGNOSTICS.nodeVersion}
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                Terminal Environment
              </span>
              <div className="flex items-center gap-2">
                <span>
                  TTY{" "}
                  <span className="text-[--tui-green]">
                    [{DIAGNOSTICS.tty ? "Yes" : "No"}]
                  </span>
                </span>
                <span className="text-[--tui-border]">|</span>
                <span>{DIAGNOSTICS.terminalSize}</span>
                <span className="text-[--tui-border]">|</span>
                <span>
                  Color{" "}
                  <span className="text-[--tui-violet]">
                    [{DIAGNOSTICS.colorSupport}]
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                Unicode Support
              </span>
              <div className="text-white flex items-center gap-2">
                <span>[{DIAGNOSTICS.unicodeSupport}]</span>
                <span className="text-xs text-[--tui-yellow]">
                  {"\u2714"} {"\u2716"} {"\u25B2"} {"\u25CF"}
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                Memory Usage
              </span>
              <div className="text-white">
                RSS: {DIAGNOSTICS.memoryRss} / Heap: {DIAGNOSTICS.memoryHeap}
              </div>
            </div>
          </div>

          <div className="border-t border-[--tui-border] border-dashed" />

          <div className="space-y-3">
            <h3 className="text-[--tui-violet] font-bold text-xs uppercase tracking-wider">
              Storage Paths
            </h3>
            <div className="grid grid-cols-[80px_1fr] gap-2 text-sm font-mono">
              <span className="text-gray-500 text-right">Config:</span>
              <span className="text-[--tui-fg]">{DIAGNOSTICS.paths.config}</span>
              <span className="text-gray-500 text-right">Data:</span>
              <span className="text-[--tui-fg]">{DIAGNOSTICS.paths.data}</span>
              <span className="text-gray-500 text-right">Cache:</span>
              <span className="text-[--tui-fg]">{DIAGNOSTICS.paths.cache}</span>
            </div>
          </div>

          <div className="border-t border-[--tui-border] border-dashed" />

          <div className="flex gap-4 pt-2">
            <Button variant="secondary" size="sm">
              [ Print Paths ]
            </Button>
            <Button variant="secondary" size="sm">
              [ Export Debug Report ]
            </Button>
            <Button variant="destructive" size="sm" className="ml-auto">
              [ Reset UI Settings ]
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
