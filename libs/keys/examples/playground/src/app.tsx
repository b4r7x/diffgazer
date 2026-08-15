import type { ComponentType } from "react";
import { useState } from "react";
import { Layout } from "./components/layout";
import { CommandPaletteDemo } from "./demos/command-palette";
import { FocusTrapDemo } from "./demos/focus-trap";
import { FocusZonesDemo } from "./demos/focus-zones";
import { GlobalShortcutsDemo } from "./demos/global-shortcuts";
import { ListNavigationDemo } from "./demos/list-navigation";
import { ScopedDialogDemo } from "./demos/scoped-dialog";
import { TabBarDemo } from "./demos/tab-bar";

interface Demo {
  id: string;
  title: string;
  section: string;
  component: ComponentType;
}

const demos: Demo[] = [
  {
    id: "global-shortcuts",
    title: "Global Shortcuts",
    section: "Basics",
    component: GlobalShortcutsDemo,
  },
  { id: "scoped-dialog", title: "Scoped Dialog", section: "Scopes", component: ScopedDialogDemo },
  { id: "focus-zones", title: "Focus Zones", section: "Zones", component: FocusZonesDemo },
  {
    id: "list-navigation",
    title: "List Navigation",
    section: "Navigation",
    component: ListNavigationDemo,
  },
  { id: "tab-bar", title: "Tab Bar", section: "Navigation", component: TabBarDemo },
  {
    id: "command-palette",
    title: "Command Palette",
    section: "Composition",
    component: CommandPaletteDemo,
  },
  { id: "focus-trap", title: "Focus Trap", section: "Focus", component: FocusTrapDemo },
];

export function App() {
  const [activeDemo, setActiveDemo] = useState("global-shortcuts");
  const ActiveComponent = demos.find((demo) => demo.id === activeDemo)?.component;

  return (
    <Layout demos={demos} activeDemo={activeDemo} onSelect={setActiveDemo}>
      {ActiveComponent ? <ActiveComponent /> : null}
    </Layout>
  );
}
