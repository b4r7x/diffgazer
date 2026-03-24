import { useNavigate } from "@tanstack/react-router";
import { Menu, MenuItem } from "diffui/components/menu";
import { Panel } from "diffui/components/panel";
import { useConfigData } from "@/app/providers/config-provider";
import { useScope, useKey } from "keyscope";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useScopedRouteState, clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useTheme } from "@/hooks/use-theme";
import { useSettings } from "@/hooks/use-settings";
import { SETTINGS_MENU_ITEMS, SETTINGS_SHORTCUTS, type SettingsAction } from "@/config/navigation";

const SETTINGS_ROUTES: Record<SettingsAction, string> = {
  trust: "/settings/trust-permissions",
  theme: "/settings/theme",
  provider: "/settings/providers",
  storage: "/settings/storage",
  "agent-execution": "/settings/agent-execution",
  analysis: "/settings/analysis",
  diagnostics: "/settings/diagnostics",
};

export function SettingsHubPage() {
  const navigate = useNavigate();
  const { provider, isConfigured, trust } = useConfigData();
  const { theme } = useTheme();
  const [selectedId, setSelectedId] = useScopedRouteState<string | null>("menuId", SETTINGS_MENU_ITEMS[0]?.id ?? null);
  const [highlightedId, setHighlightedId] = useScopedRouteState<string | null>(
    "highlightedId",
    SETTINGS_MENU_ITEMS[0]?.id ?? null
  );
  const isTrusted = Boolean(trust?.capabilities.readFiles);
  const { settings, error: settingsError } = useSettings();

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useScope("settings-hub");
  useKey("Escape", () => navigate({ to: "/" }));

  const handleActivate = (id: string) => {
    const route = SETTINGS_ROUTES[id as SettingsAction];
    if (route) {
      clearScopedRouteState(route, "highlightedId");
      navigate({ to: route });
    }
  };

  const providerLabel = isConfigured && provider ? provider.toUpperCase() : "Not configured";
  const storageLabel = settings?.secretsStorage
    ? settings.secretsStorage.toUpperCase()
    : "Not set";

  const menuValues: Record<SettingsAction, { value: string; valueVariant?: "default" | "success" | "success-badge" | "muted" }> = {
    trust: {
      value: isTrusted ? "Trusted" : "Not trusted",
      valueVariant: isTrusted ? "success-badge" : "muted",
    },
    theme: {
      value: theme.toUpperCase(),
      valueVariant: "default",
    },
    provider: {
      value: providerLabel,
      valueVariant: isConfigured ? "success" : "muted",
    },
    storage: {
      value: storageLabel,
      valueVariant: settings?.secretsStorage ? "default" : "muted",
    },
    "agent-execution": {
      value: settings?.agentExecution
        ? settings.agentExecution === "parallel"
          ? "Parallel"
          : "Sequential"
        : "Sequential",
      valueVariant: "default",
    },
    analysis: {
      value: settings?.defaultLenses?.length
        ? `${settings.defaultLenses.length} agents`
        : "Default",
      valueVariant: settings?.defaultLenses?.length ? "default" : "muted",
    },
    diagnostics: {
      value: "Local",
      valueVariant: "muted",
    },
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
      <div className="w-full max-w-3xl">
        <Panel className="bg-tui-bg shadow-2xl">
          <div className="absolute -top-3 left-4 bg-tui-bg px-2 text-xs font-bold uppercase tracking-wider text-tui-muted">SETTINGS HUB</div>
          <Menu
            selectedId={selectedId}
            highlightedId={highlightedId}
            onHighlightChange={setHighlightedId}
            onSelect={handleActivate}
            variant="hub"
            className="flex flex-col text-sm pt-2"
            autoFocus
          >
            {SETTINGS_MENU_ITEMS.map((item) => {
              const meta = menuValues[item.id];
              return (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  value={meta.value}
                  valueVariant={meta.valueVariant}
                >
                  {item.label}
                </MenuItem>
              );
            })}
          </Menu>
        </Panel>

        <div className="mt-6 flex gap-4 text-xs text-muted-foreground font-mono select-none">
          <span>config path: ~/.diffgazer/config.json</span>
          <span className="text-muted-foreground">|</span>
          <span>{settingsError ? settingsError : "local settings"}</span>
        </div>
      </div>
    </div>
  );
}
