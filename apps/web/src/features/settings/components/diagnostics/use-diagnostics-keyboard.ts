import {
  type DiagnosticsData,
  deriveDiagnosticsActions,
  refreshAllDiagnostics,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useEffect, useRef, useState } from "react";

const BUTTON_COUNT = 2;
const SETTINGS_DIAGNOSTICS_SCOPE = "settings-diagnostics";

interface UseDiagnosticsKeyboardOptions {
  diagnostics: DiagnosticsData;
}

interface UseDiagnosticsKeyboardResult {
  focusedIndex: number;
  getActionProps: ReturnType<typeof useActionRowNavigation>["getActionProps"];
  focusFallbackRef: RefObject<HTMLDivElement | null>;
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
  const focusFallbackRef = useRef<HTMLDivElement>(null);

  useScope(SETTINGS_DIAGNOSTICS_SCOPE);

  const handleRefreshAll = async () => {
    if (isRefreshingAll || isRefreshingContext) return;

    setIsRefreshingAll(true);
    setRefreshError(null);

    try {
      const results = await refreshAllDiagnostics({ retryServer, refetchContext });
      const failedCount = results.filter((result) => result.status === "rejected").length;
      setLastRefreshedAt(new Date().toISOString());
      if (failedCount > 0) setRefreshError("Refresh failed for some diagnostics sources.");
    } finally {
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

  const { refreshAllDisabled, contextActionDisabled } = deriveDiagnosticsActions({
    canRegenerate,
    isRefreshing: isRefreshingContext,
    isRefreshingAll,
  });
  const { focusedIndex, inActions, getActionProps } = useActionRowNavigation<readonly unknown[]>({
    enabled: true,
    actionCount: BUTTON_COUNT,
    disabledActions: [refreshAllDisabled, contextActionDisabled],
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: handleButtonAction,
    defaultZone: "actions",
    canExitActions: false,
  });

  const footerShortcuts: Shortcut[] = inActions
    ? [
        {
          key: "\u2190/\u2192",
          label: "Move Action",
          disabled: refreshAllDisabled && contextActionDisabled,
        },
        {
          key: "Enter/Space",
          label: "Activate",
          disabled: focusedIndex === 0 ? refreshAllDisabled : contextActionDisabled,
        },
        { key: "r/R", label: "Refresh All", disabled: refreshAllDisabled },
      ]
    : [
        { key: "\u2193", label: "Focus Actions" },
        { key: "r/R", label: "Refresh All", disabled: refreshAllDisabled },
      ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [BACK_SHORTCUT],
  });

  useKey(
    ["r", "R"],
    () => {
      void handleRefreshAll();
    },
    {
      scope: SETTINGS_DIAGNOSTICS_SCOPE,
      enabled: !refreshAllDisabled,
    },
  );

  useKey("Escape", () => navigate({ to: "/settings" }), { scope: SETTINGS_DIAGNOSTICS_SCOPE });

  return {
    focusedIndex,
    getActionProps,
    focusFallbackRef,
    isRefreshingAll,
    refreshError,
    lastRefreshedAt,
    handleRefreshAll,
  };
}
