import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Shortcut } from "@stargazer/schemas/ui";
import { useKey, useScope } from "@stargazer/keyboard";
import { useFooterNavigation } from "@/hooks/use-footer-navigation";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useConfigData } from "@/app/providers/config-provider";
import { cn } from "@/utils/cn";
import { useContextManagement } from "@/features/settings/hooks/use-context-management";
import { useServerStatus } from "@/hooks/use-server-status";

const NA = "Unavailable";

const BUTTON_COUNT = 2;

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return NA;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm font-mono">
      <span className="text-tui-muted text-right">{label}:</span>
      <span className="text-tui-fg break-all">{value}</span>
    </div>
  );
}

export function DiagnosticsPage() {
  const navigate = useNavigate();
  const { state: serverState, retry } = useServerStatus();
  const { provider, model, setupStatus } = useConfigData();
  const {
    contextStatus,
    contextGeneratedAt,
    isRefreshing,
    error: contextError,
    reloadContextStatus,
    handleRefreshContext,
  } = useContextManagement();
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  useScope("settings-diagnostics");
  const canRegenerate = contextStatus === "ready" || contextStatus === "missing";

  const serverValue = useMemo(() => {
    if (serverState.status === "checking") return "Checking...";
    if (serverState.status === "connected") return "Connected";
    return `Error: ${serverState.message}`;
  }, [serverState]);

  const overallState = useMemo<"loading" | "error" | "empty" | "success">(() => {
    if (isRefreshingAll || serverState.status === "checking" || contextStatus === "loading") return "loading";
    if (serverState.status === "error" && contextStatus === "error") return "error";
    if (!provider && contextStatus === "missing") return "empty";
    return "success";
  }, [contextStatus, isRefreshingAll, provider, serverState.status]);

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    setRefreshError(null);
    const results = await Promise.allSettled([retry(), reloadContextStatus()]);
    const failedCount = results.filter((result) => result.status === "rejected").length;
    setLastRefreshedAt(new Date().toISOString());
    if (failedCount > 0) setRefreshError("Refresh failed for some diagnostics sources.");
    setIsRefreshingAll(false);
  };

  useEffect(() => {
    if (lastRefreshedAt) return;
    if (serverState.status !== "checking" && contextStatus !== "loading") {
      setLastRefreshedAt(new Date().toISOString());
    }
  }, [contextStatus, lastRefreshedAt, serverState.status]);

  const handleButtonAction = (index: number) => {
    if (index === 0 && !isRefreshingAll) {
      void handleRefreshAll();
      return;
    }

    if (index === 1 && canRegenerate && !isRefreshing) {
      void handleRefreshContext();
    }
  };

  const { focusedIndex, inFooter, enterFooter } = useFooterNavigation({
    enabled: true,
    buttonCount: BUTTON_COUNT,
    onAction: handleButtonAction,
  });

  useEffect(() => {
    enterFooter(0);
  }, [enterFooter]);

  const footerShortcuts: Shortcut[] = inFooter
    ? [
        { key: "←/→", label: "Move Action" },
        { key: "Enter/Space", label: "Activate" },
        { key: "r/R", label: "Refresh All" },
      ]
    : [
        { key: "↓", label: "Focus Actions" },
        { key: "r/R", label: "Refresh All" },
      ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  useKey("r", () => { void handleRefreshAll(); });
  useKey("R", () => { void handleRefreshAll(); });

  useKey("Escape", () => navigate({ to: "/settings" }));

  return (
    <div className="flex flex-1 overflow-hidden px-4 justify-center items-center">
      <div className="w-full max-w-2xl flex flex-col border border-tui-border bg-[#161b22] shadow-lg">
        <div className="bg-tui-selection border-b border-tui-border px-4 py-2 flex justify-between items-center">
          <span className="font-bold text-tui-fg">System Diagnostics</span>
          <span className="text-xs text-tui-muted">{overallState}</span>
        </div>

        <div className="p-6 space-y-8">
          <div className="grid grid-cols-2 gap-x-8 text-sm">
            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">Version Info</span>
              <div className="flex items-center gap-2">
                <span className="text-tui-blue">Stargazer Web</span>
                <span className="text-tui-border">|</span>
                <span className="text-tui-green">{import.meta.env.MODE.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">Context Snapshot</span>
              <div className="text-white flex items-center gap-2">
                <span>[{contextStatus}]</span>
                {contextStatus === "ready" && <span className="text-xs text-tui-yellow">{formatTimestamp(contextGeneratedAt)}</span>}
              </div>
            </div>
          </div>

          <div className="border-t border-tui-border border-dashed" />

          <div className="space-y-3">
            <h3 className="text-tui-violet font-bold text-xs uppercase tracking-wider">Diagnostic Snapshot</h3>
            <div className="space-y-1">
              <Row
                label="Health"
                value={serverValue}
              />
              <Row
                label="Setup"
                value={setupStatus ? (setupStatus.isReady ? "Ready" : `Incomplete (${setupStatus.missing.join(", ") || "unknown"})`) : NA}
              />
              <Row
                label="Provider"
                value={provider ? `${provider}${model ? ` (${model})` : ""}` : NA}
              />
              <Row
                label="Refreshed"
                value={formatTimestamp(lastRefreshedAt)}
              />
            </div>
          </div>

          <div className="border-t border-tui-border border-dashed" />

          <div className="flex gap-4 pt-2">
            <button
              disabled={isRefreshingAll}
              className={cn(
                "bg-tui-bg border border-tui-border hover:bg-tui-selection hover:text-white hover:border-tui-blue text-tui-fg px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-tui-blue",
                focusedIndex === 0 && !isRefreshingAll && "ring-2 ring-tui-blue border-tui-blue",
                isRefreshingAll && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => void handleRefreshAll()}
            >
              [ {isRefreshingAll ? "Refreshing..." : "Refresh Diagnostics"} ]
            </button>
            <button
              disabled={!canRegenerate || isRefreshing}
              className={cn(
                "bg-tui-bg border border-tui-border hover:bg-tui-selection hover:text-white hover:border-tui-green text-tui-fg px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-tui-green",
                focusedIndex === 1 && canRegenerate && !isRefreshing && "ring-2 ring-tui-green border-tui-green",
                (!canRegenerate || isRefreshing) && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => void handleRefreshContext()}
            >
              [ {isRefreshing
                ? "Working..."
                : contextStatus === "ready"
                  ? "Regenerate Context"
                  : "Generate Context"} ]
            </button>
          </div>

          {(refreshError || contextError || (serverState.status === "error" ? serverState.message : null)) && (
            <p className="text-tui-red text-sm">
              {refreshError ?? contextError ?? (serverState.status === "error" ? serverState.message : null)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
