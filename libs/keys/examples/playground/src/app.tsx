import { useState } from "react";
import { Layout } from "./components/layout";
import { GlobalShortcutsDemo } from "./demos/global-shortcuts";
import { ScopedDialogDemo } from "./demos/scoped-dialog";
import { FocusZonesDemo } from "./demos/focus-zones";
import { ListNavigationDemo } from "./demos/list-navigation";
import { TabBarDemo } from "./demos/tab-bar";
import { CommandPaletteDemo } from "./demos/command-palette";
import { FocusTrapDemo } from "./demos/focus-trap";

const demos = [
  { id: "global-shortcuts", title: "Global Shortcuts", section: "Basics" },
  { id: "scoped-dialog", title: "Scoped Dialog", section: "Scopes" },
  { id: "focus-zones", title: "Focus Zones", section: "Zones" },
  { id: "list-navigation", title: "List Navigation", section: "Navigation" },
  { id: "tab-bar", title: "Tab Bar", section: "Navigation" },
  { id: "command-palette", title: "Command Palette", section: "Composition" },
  { id: "focus-trap", title: "Focus Trap", section: "Focus" },
];

const demoComponents: Record<string, React.FC> = {
  "global-shortcuts": GlobalShortcutsDemo,
  "scoped-dialog": ScopedDialogDemo,
  "focus-zones": FocusZonesDemo,
  "list-navigation": ListNavigationDemo,
  "tab-bar": TabBarDemo,
  "command-palette": CommandPaletteDemo,
  "focus-trap": FocusTrapDemo,
};

export function App() {
  const [activeDemo, setActiveDemo] = useState("global-shortcuts");
  const ActiveComponent = demoComponents[activeDemo];

  return (
    <Layout demos={demos} activeDemo={activeDemo} onSelect={setActiveDemo}>
      {ActiveComponent ? <ActiveComponent /> : null}
    </Layout>
  );
}
