"use client";

import { useNavigate } from "@tanstack/react-router";
import { SETTINGS_MENU_ITEMS, SETTINGS_SHORTCUTS, type SettingsAction } from "@repo/core";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Panel, PanelHeader } from "@/components/ui/containers";
import { useScope, useKey } from "@/hooks/keyboard";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";

const MENU_VALUES: Record<SettingsAction, { value: string; valueVariant?: "success" | "success-badge" | "muted" | "default" }> = {
  trust: { value: "Trusted", valueVariant: "success-badge" },
  theme: { value: "DARK" },
  provider: { value: "Gemini", valueVariant: "success" },
  diagnostics: { value: "v2.1.0", valueVariant: "muted" },
};

const FOOTER_RIGHT = [{ key: "", label: "HUB-MODE" }];

export function SettingsHubPage() {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useScopedRouteState('menuIndex', 0);

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS, rightShortcuts: FOOTER_RIGHT });

  useScope("settings-hub");
  useKey("Escape", () => navigate({ to: "/" }));

  const handleActivate = (item: { id: string }) => {
    switch (item.id as SettingsAction) {
      case "trust":
        navigate({ to: "/settings/trust" });
        break;
      case "theme":
        navigate({ to: "/settings/theme" });
        break;
      case "provider":
        navigate({ to: "/settings/providers" });
        break;
      case "diagnostics":
        navigate({ to: "/settings/about" });
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
              const { value, valueVariant } = MENU_VALUES[item.id];
              return (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  value={value}
                  valueVariant={valueVariant}
                >
                  {item.label}
                </MenuItem>
              );
            })}
          </Menu>
        </Panel>

        <div className="mt-6 flex gap-4 text-xs text-gray-600 font-mono select-none">
          <span>config path: ~/.config/stargazer/settings.json</span>
          <span className="text-gray-700">|</span>
          <span>last sync: 2m ago</span>
        </div>
      </div>
    </div>
  );
}
