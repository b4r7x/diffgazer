import { useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { buildHubValues, hasRepositoryReadAccess } from "@diffgazer/core/schemas/config";
import {
  SETTINGS_MENU_ITEMS,
  SETTINGS_SHORTCUTS,
  type SettingsAction,
} from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Menu, MenuItem } from "@diffgazer/ui/components/menu";
import { Panel } from "@diffgazer/ui/components/panel";
import { useNavigate } from "@tanstack/react-router";
import { ConfigurationStatus } from "@/components/shared/configuration-status";
import { useConfigData } from "@/hooks/use-config";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useTheme } from "@/hooks/use-theme";

const SETTINGS_ROUTES: Record<SettingsAction, string> = {
  trust: "/settings/trust-permissions",
  theme: "/settings/theme",
  provider: "/settings/providers",
  storage: "/settings/storage",
  "agent-execution": "/settings/agent-execution",
  analysis: "/settings/analysis",
  diagnostics: "/settings/diagnostics",
};

const SETTINGS_MENU_ITEM_IDS = new Set<string>(SETTINGS_MENU_ITEMS.map((item) => item.id));

function getSettingsMenuHighlighted(value: string | null): string | null {
  if (!value) return value;
  if (SETTINGS_MENU_ITEM_IDS.has(value)) return value;
  return SETTINGS_MENU_ITEMS[0]?.id ?? null;
}

export function SettingsHubPage() {
  const navigate = useNavigate();
  const { loadState, provider, isConfigured, repoRoot, trust, configPath } = useConfigData();
  const { theme } = useTheme();
  const [highlighted, setHighlighted] = useScopedRouteState<string | null>(
    "highlighted",
    SETTINGS_MENU_ITEMS[0]?.id ?? null,
  );
  const effectiveHighlighted = getSettingsMenuHighlighted(highlighted);
  const { data: settings, error: settingsQueryError } = useSettings();
  const settingsError = settingsQueryError?.message ?? null;

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useScope("settings-hub");
  useKey("Escape", () => navigate({ to: "/" }));

  if (loadState.status !== "ready") {
    return <ConfigurationStatus status={loadState.status} />;
  }

  const handleActivate = (id: string) => {
    const route = SETTINGS_ROUTES[id as SettingsAction];
    if (route) {
      navigate({ to: route });
    }
  };

  const isTrusted = hasRepositoryReadAccess(trust, repoRoot);
  const values = buildHubValues({
    provider,
    isConfigured,
    isTrusted,
    theme,
    secretsStorage: settings?.secretsStorage,
    agentExecution: settings?.agentExecution,
    selectedLensCount: settings?.defaultLenses?.length,
  });

  const menuValues: Record<
    SettingsAction,
    { value: string; valueVariant?: "default" | "success" | "success-badge" | "muted" }
  > = {
    trust: {
      value: values.trust,
      valueVariant: isTrusted ? "success-badge" : "muted",
    },
    theme: {
      value: values.theme,
      valueVariant: "default",
    },
    provider: {
      value: values.provider,
      valueVariant: isConfigured ? "success" : "muted",
    },
    storage: {
      value: values.storage,
      valueVariant: settings?.secretsStorage ? "default" : "muted",
    },
    "agent-execution": {
      value: values["agent-execution"],
      valueVariant: "default",
    },
    analysis: {
      value: values.analysis,
      valueVariant: settings?.defaultLenses?.length ? "default" : "muted",
    },
    diagnostics: {
      value: values.diagnostics,
      valueVariant: "muted",
    },
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-12 pt-4">
      <div className="m-auto w-full max-w-3xl">
        <Panel
          frame="hairline"
          density="compact"
          aria-label="Settings Hub"
          className="mt-4 bg-background shadow-2xl"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Settings Hub
          </Panel.Label>
          {/* Menu-of-actions over a links list is deliberate (F-231): the hub keeps
              TUI-parity keyboard navigation, and the app runs as a local single-window
              product where new-tab/middle-click link semantics do not apply. */}
          <Menu
            highlighted={effectiveHighlighted}
            onHighlightChange={setHighlighted}
            onSelect={handleActivate}
            variant="detail"
            className="flex flex-col text-sm"
            aria-label="Settings"
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
          <Panel.Footer className="font-mono">
            <span>config path: {configPath}</span>
            <span>{settingsError ?? "local settings"}</span>
          </Panel.Footer>
        </Panel>
      </div>
    </div>
  );
}
