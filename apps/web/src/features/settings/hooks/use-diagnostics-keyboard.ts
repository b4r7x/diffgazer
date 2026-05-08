import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Shortcut } from "@diffgazer/core/schemas/ui";
import { useKey, useScope } from "@diffgazer/keys";
import { useFooterNavigation } from "@/hooks/use-footer-navigation";
import { usePageFooter } from "@/hooks/use-page-footer";
import type { DiagnosticsData } from "@diffgazer/core/api/hooks";

const BUTTON_COUNT = 2;
const SETTINGS_DIAGNOSTICS_SCOPE = "settings-diagnostics";

interface UseDiagnosticsKeyboardOptions {
  diagnostics: DiagnosticsData;
}

interface UseDiagnosticsKeyboardResult {
  focusedIndex: number;
  isRefreshingAll: boolean;
  refreshError: string | null;
  lastRefreshedAt: string | null;
  handleRefreshAll: () => Promise<void>;
}

export function useDiagnosticsKeyboard({
  diagnostics,
}: UseDiagnosticsKeyboardOptions): UseDiagnosticsKeyboardResult {
  const navigate = useNavigate();
  const {
    retryServer,
    refetchContext,
    canRegenerate,
    isRefreshingContext,
    handleRefreshContext,
    contextStatus,
    serverState,
  } = diagnostics;

  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const refreshAllInFlight = useRef(false);

  useScope(SETTINGS_DIAGNOSTICS_SCOPE);

  const handleRefreshAll = async () => {
    if (refreshAllInFlight.current) return;
    if (isRefreshingContext) return;

    refreshAllInFlight.current = true;
    setIsRefreshingAll(true);
    setRefreshError(null);

    try {
      const results = await Promise.allSettled([
        retryServer(),
        refetchContext(),
      ]);
      const failedCount = results.filter((result) => result.status === "rejected").length;
      setLastRefreshedAt(new Date().toISOString());
      if (failedCount > 0) setRefreshError("Refresh failed for some diagnostics sources.");
    } finally {
      refreshAllInFlight.current = false;
      setIsRefreshingAll(false);
    }
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

    if (index === 1 && canRegenerate && !isRefreshingContext && !isRefreshingAll) {
      handleRefreshContext();
    }
  };

  const { focusedIndex, inFooter } = useFooterNavigation({
    enabled: true,
    buttonCount: BUTTON_COUNT,
    onAction: handleButtonAction,
    defaultZone: "footer",
  });

  const footerShortcuts: Shortcut[] = inFooter
    ? [
        { key: "\u2190/\u2192", label: "Move Action" },
        { key: "Enter/Space", label: "Activate" },
        { key: "r/R", label: "Refresh All" },
      ]
    : [
        { key: "\u2193", label: "Focus Actions" },
        { key: "r/R", label: "Refresh All" },
      ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  useKey("r", () => { void handleRefreshAll(); }, { scope: SETTINGS_DIAGNOSTICS_SCOPE });
  useKey("R", () => { void handleRefreshAll(); }, { scope: SETTINGS_DIAGNOSTICS_SCOPE });

  useKey("Escape", () => navigate({ to: "/settings" }), { scope: SETTINGS_DIAGNOSTICS_SCOPE });

  return {
    focusedIndex,
    isRefreshingAll,
    refreshError,
    lastRefreshedAt,
    handleRefreshAll,
  };
}
