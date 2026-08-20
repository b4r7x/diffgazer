import { type DiagnosticsData, refreshAllDiagnostics } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  BACK_SHORTCUT,
  deriveDiagnosticsActions,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { DECLINE, useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
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
    refetchInit,
    canRegenerate,
    isRefreshingContext,
    handleRefreshContext,
    contextStatus,
    serverState,
  } = diagnostics;

  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const focusFallbackRef = useRef<HTMLDivElement>(null);

  useScope(SETTINGS_DIAGNOSTICS_SCOPE);

  const handleRefreshAll = async () => {
    if (isRefreshingAll || isRefreshingContext) return;

    setIsRefreshingAll(true);

    try {
      await refreshAllDiagnostics({ retryServer, refetchContext, refetchInit });
      setLastRefreshedAt(new Date().toISOString());
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

  // Plain dispatch: disabledActions below is the one statement of which action can
  // run, and useActionRowNavigation refuses a disabled index before it gets here.
  const handleButtonAction = (index: number) => {
    if (index === 0) void handleRefreshAll();
    else handleRefreshContext();
  };

  const { refreshAllDisabled, contextActionDisabled } = deriveDiagnosticsActions({
    canRegenerate,
    isRefreshing: isRefreshingContext,
    isRefreshingAll,
  });
  const { focusedIndex, inActions, getActionProps } = useActionRowNavigation({
    enabled: true,
    actionCount: BUTTON_COUNT,
    disabledActions: [refreshAllDisabled, contextActionDisabled],
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: handleButtonAction,
    defaultZone: "actions",
    canExitActions: false,
    scope: SETTINGS_DIAGNOSTICS_SCOPE,
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

  // Focus never leaves the action row (canExitActions is off), so the snapshot
  // pane scrolls through scope keys like r/R rather than a tab stop of its own.
  const scrollSnapshot = (event: KeyboardEvent) => {
    const el = focusFallbackRef.current;
    if (!el || el.scrollHeight <= el.clientHeight) return DECLINE;
    switch (event.key) {
      case "PageUp":
        el.scrollTop -= el.clientHeight * 0.8;
        return;
      case "PageDown":
        el.scrollTop += el.clientHeight * 0.8;
        return;
      case "Home":
        el.scrollTop = 0;
        return;
      case "End":
        el.scrollTop = el.scrollHeight;
        return;
      default:
        return DECLINE;
    }
  };

  useKey(["PageUp", "PageDown", "Home", "End"], scrollSnapshot, {
    scope: SETTINGS_DIAGNOSTICS_SCOPE,
    preventDefault: true,
  });

  return {
    focusedIndex,
    getActionProps,
    focusFallbackRef,
    isRefreshingAll,
    lastRefreshedAt,
    handleRefreshAll,
  };
}
