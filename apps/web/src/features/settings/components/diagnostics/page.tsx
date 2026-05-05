import { useConfigData } from "@/app/providers/config-provider";
import { cn } from "@diffgazer/core/cn";
import { useDiagnosticsData } from "@diffgazer/core/api/hooks";
import { formatTimestampOrNA } from "@diffgazer/core/format";
import { useDiagnosticsKeyboard } from "../../hooks/use-diagnostics-keyboard.js";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm font-mono">
      <span className="text-tui-muted text-right">{label}:</span>
      <span className="text-tui-fg break-all">{value}</span>
    </div>
  );
}

export function DiagnosticsPage() {
  const { provider, model, setupStatus } = useConfigData();
  const diagnostics = useDiagnosticsData();
  const {
    serverState,
    contextStatus,
    contextGeneratedAt,
    contextError,
    canRegenerate,
    handleRefreshContext,
    isRefreshingContext: isRefreshing,
  } = diagnostics;

  const {
    focusedIndex,
    isRefreshingAll,
    refreshError,
    lastRefreshedAt,
    handleRefreshAll,
  } = useDiagnosticsKeyboard({ diagnostics });

  const serverValue = (() => {
    if (serverState.status === "checking") return "Checking...";
    if (serverState.status === "connected") return "Connected";
    return `Error: ${serverState.message}`;
  })();

  const overallState: "loading" | "error" | "empty" | "success" = (() => {
    if (isRefreshingAll || serverState.status === "checking" || contextStatus === "loading") return "loading";
    if (serverState.status === "error" && contextStatus === "error") return "error";
    if (!provider && contextStatus === "missing") return "empty";
    return "success";
  })();

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
                <span className="text-tui-blue">Diffgazer Web</span>
                <span className="text-tui-border">|</span>
                <span className="text-tui-green">{import.meta.env.MODE.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">Context Snapshot</span>
              <div className="text-white flex items-center gap-2">
                <span>[{contextStatus}]</span>
                {contextStatus === "ready" && <span className="text-xs text-tui-yellow">{formatTimestampOrNA(contextGeneratedAt, "Unavailable")}</span>}
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
                value={setupStatus ? (setupStatus.isReady ? "Ready" : `Incomplete (${setupStatus.missing.join(", ") || "unknown"})`) : "Unavailable"}
              />
              <Row
                label="Provider"
                value={provider ? `${provider}${model ? ` (${model})` : ""}` : "Unavailable"}
              />
              <Row
                label="Refreshed"
                value={formatTimestampOrNA(lastRefreshedAt, "Unavailable")}
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
