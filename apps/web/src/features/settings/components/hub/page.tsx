import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Panel, PanelHeader } from "@/components/ui/containers";
import { useConfigData } from "@/app/providers/config-provider";
import { useScope, useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useTheme } from "@/hooks/use-theme";
import { useSettings } from "@/hooks/use-settings";
import { SETTINGS_MENU_ITEMS, SETTINGS_SHORTCUTS, type SettingsAction } from "@/config/navigation";

const FOOTER_RIGHT = [{ key: "", label: "HUB-MODE" }];

export function SettingsHubPage() {
  const navigate = useNavigate();
  const { provider, isConfigured, trust } = useConfigData();
  const { theme } = useTheme();
  const [selectedIndex, setSelectedIndex] = useScopedRouteState("menuIndex", 0);
  const isTrusted = Boolean(trust?.capabilities.readFiles);
  const { settings, error: settingsError } = useSettings();

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS, rightShortcuts: FOOTER_RIGHT });

  useScope("settings-hub");
  useKey("Escape", () => navigate({ to: "/" }));

  const menuValues = useMemo<Record<SettingsAction, { value: string; valueVariant?: "default" | "success" | "success-badge" | "muted" }>>(() => {
    const providerLabel = isConfigured && provider ? provider.toUpperCase() : "Not configured";
    const storageLabel = settings?.secretsStorage
      ? settings.secretsStorage.toUpperCase()
      : "Not set";

    return {
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
  }, [isConfigured, provider, settings?.secretsStorage, settings?.defaultLenses?.length, theme, isTrusted]);

  const settingsRoutes: Record<SettingsAction, string> = {
    trust: "/settings/trust-permissions",
    theme: "/settings/theme",
    provider: "/settings/providers",
    storage: "/settings/storage",
    analysis: "/settings/analysis",
    diagnostics: "/settings/diagnostics",
  };

  const handleActivate = (item: { id: SettingsAction }) => {
    const route = settingsRoutes[item.id];
    if (route) navigate({ to: route });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
      <div className="w-full max-w-3xl">
        <Panel className="bg-tui-bg shadow-2xl">
          <PanelHeader variant="floating">SETTINGS HUB</PanelHeader>
          <Menu
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onActivate={handleActivate}
            keyboardEnabled
            variant="hub"
            className="flex flex-col text-sm pt-2"
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

        <div className="mt-6 flex gap-4 text-xs text-gray-600 font-mono select-none">
          <span>config path: ~/.stargazer/config.json</span>
          <span className="text-gray-700">|</span>
          <span>{settingsError ? settingsError : "local settings"}</span>
        </div>
      </div>
    </div>
  );
}
