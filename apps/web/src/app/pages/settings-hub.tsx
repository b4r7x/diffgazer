"use client";

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Menu } from "@/components/ui/menu";
import { Panel } from "@/components/ui/panel";
import { useScope, useKey } from "@/hooks/keyboard";
import { useRouteState } from "@/hooks/use-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";

type SettingsSection =
  | "trust"
  | "theme"
  | "provider"
  | "credentials"
  | "controls"
  | "diagnostics";

const MENU_ITEMS: {
  id: SettingsSection;
  label: string;
  value: string;
  valueVariant?: "success" | "success-badge" | "muted" | "default";
}[] = [
  {
    id: "trust",
    label: "Trust & Permissions",
    value: "Trusted",
    valueVariant: "success-badge",
  },
  { id: "theme", label: "Theme", value: "DARK" },
  {
    id: "provider",
    label: "Provider & Model",
    value: "Gemini",
    valueVariant: "success",
  },
  {
    id: "credentials",
    label: "Credentials",
    value: "2 Active",
    valueVariant: "muted",
  },
  { id: "controls", label: "Controls", value: "Default", valueVariant: "muted" },
  {
    id: "diagnostics",
    label: "Diagnostics/About",
    value: "v2.1.0",
    valueVariant: "muted",
  },
];

const FOOTER_SHORTCUTS = [
  { key: "up/dn", label: "Select" },
  { key: "Enter", label: "Edit" },
  { key: "Esc", label: "Back" },
];

const FOOTER_RIGHT = [{ key: "", label: "HUB-MODE" }];

export function SettingsHubPage() {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useRouteState('menuIndex', 1);

  const footerShortcuts = useMemo(() => FOOTER_SHORTCUTS, []);
  const footerRight = useMemo(() => FOOTER_RIGHT, []);
  usePageFooter({ shortcuts: footerShortcuts, rightShortcuts: footerRight });

  useScope("settings-hub");
  useKey("Escape", () => navigate({ to: "/" }));

  const handleActivate = (item: { id: string }) => {
    switch (item.id) {
      case "trust":
        navigate({ to: "/settings/trust" });
        break;
      case "theme":
        navigate({ to: "/settings/theme" });
        break;
      case "provider":
        navigate({ to: "/settings/provider" });
        break;
      case "credentials":
        navigate({ to: "/settings/credentials" });
        break;
      case "controls":
        navigate({ to: "/settings/controls" });
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
          <Panel.Header variant="floating">SETTINGS HUB</Panel.Header>
          <Menu
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onActivate={handleActivate}
            keyboardEnabled
            variant="hub"
            className="flex flex-col text-sm pt-2"
          >
            {MENU_ITEMS.map((item) => (
              <Menu.Item
                key={item.id}
                id={item.id}
                value={item.value}
                valueVariant={item.valueVariant}
              >
                {item.label}
              </Menu.Item>
            ))}
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
