import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SettingsConfig } from "@stargazer/schemas/config";
import {
  Menu,
  MenuItem,
  Panel,
  PanelHeader,
} from "@/components/ui";
import { useConfig } from "@/features/settings";
import { useScope, useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useTheme } from "@/hooks/use-theme";
import { api } from "@/lib/api";
import { SETTINGS_MENU_ITEMS, SETTINGS_SHORTCUTS, type SettingsAction } from "@/lib/navigation";

const FOOTER_RIGHT = [{ key: "", label: "HUB-MODE" }];

export function SettingsHubPage() {
  const navigate = useNavigate();
  const { provider, isConfigured, trust } = useConfig();
  const { theme } = useTheme();
  const [selectedIndex, setSelectedIndex] = useScopedRouteState("menuIndex", 0);
  const isTrusted = Boolean(trust?.capabilities.readFiles);

  const [settings, setSettings] = useState<SettingsConfig | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS, rightShortcuts: FOOTER_RIGHT });

  useScope("settings-hub");
  useKey("Escape", () => navigate({ to: "/" }));

  useEffect(() => {
    let active = true;

    api
      .getSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
      })
      .catch((err) => {
        if (!active) return;
        setSettingsError(err instanceof Error ? err.message : "Failed to load settings");
      });

    return () => {
      active = false;
    };
  }, []);

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

  const handleActivate = (item: { id: string }) => {
    switch (item.id as SettingsAction) {
      case "trust":
        navigate({ to: "/settings/trust-permissions" });
        break;
      case "theme":
        navigate({ to: "/settings/theme" });
        break;
      case "provider":
        navigate({ to: "/settings/providers" });
        break;
      case "storage":
        navigate({ to: "/settings/storage" });
        break;
      case "analysis":
        navigate({ to: "/settings/analysis" });
        break;
      case "diagnostics":
        navigate({ to: "/settings/diagnostics" });
        break;
    }
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
