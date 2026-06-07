import { useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import type { AgentExecution } from "@diffgazer/core/schemas/config";
import {
  SETTINGS_MENU_ITEMS,
  SETTINGS_SHORTCUTS,
  type SettingsAction,
} from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Menu, MenuItem } from "@diffgazer/ui/components/menu";
import { Panel } from "@diffgazer/ui/components/panel";
import { useNavigate } from "@tanstack/react-router";
import { useConfigData } from "@/app/providers/config";
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

function getAgentExecutionLabel(mode: AgentExecution | undefined): string {
  if (!mode) return "Sequential";
  if (mode === "parallel") return "Parallel";
  return "Sequential";
}

export function SettingsHubPage() {
  const navigate = useNavigate();
  const { provider, isConfigured, trust } = useConfigData();
  const { theme } = useTheme();
  const [highlighted, setHighlighted] = useScopedRouteState<string | null>(
    "highlighted",
    SETTINGS_MENU_ITEMS[0]?.id ?? null,
  );
  const effectiveHighlighted = getSettingsMenuHighlighted(highlighted);
  const isTrusted = Boolean(trust?.capabilities.readFiles);
  const { data: settings, error: settingsQueryError } = useSettings();
  const settingsError = settingsQueryError?.message ?? null;

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useScope("settings-hub");
  useKey("Escape", () => navigate({ to: "/" }));

  const handleActivate = (id: string) => {
    const route = SETTINGS_ROUTES[id as SettingsAction];
    if (route) {
      navigate({ to: route });
    }
  };

  const providerLabel = isConfigured && provider ? provider.toUpperCase() : "Not configured";
  const storageLabel = settings?.secretsStorage ? settings.secretsStorage.toUpperCase() : "Not set";

  const menuValues: Record<
    SettingsAction,
    { value: string; valueVariant?: "default" | "success" | "success-badge" | "muted" }
  > = {
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
      value: getAgentExecutionLabel(settings?.agentExecution),
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
          <Panel.Header>
            <Panel.Title>SETTINGS HUB</Panel.Title>
          </Panel.Header>
          <Menu
            highlighted={effectiveHighlighted}
            onHighlightChange={setHighlighted}
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
