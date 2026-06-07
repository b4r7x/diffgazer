"use client";

import { useState } from "react";
import { NavigationList } from "@/components/ui/navigation-list";

const items = [
  { id: "dashboard", title: "Dashboard" },
  { id: "settings", title: "Settings" },
  { id: "profile", title: "Profile" },
  { id: "help", title: "Help" },
];

export default function NavigationListIndicators() {
  const [selected, setSelected] = useState("settings");

  return (
    <div className="grid grid-cols-2 gap-4">
      {(["bar", "bar-thick", "arrow", "bracket"] as const).map((indicator) => (
        <div key={indicator} className="border border-border">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            {indicator}
          </div>
          <NavigationList
            indicator={indicator}
            selectedId={selected}
            onSelect={setSelected}
            aria-label={`${indicator} indicator`}
          >
            {items.map((item) => (
              <NavigationList.Item key={item.id} id={item.id}>
                <NavigationList.Title>{item.title}</NavigationList.Title>
              </NavigationList.Item>
            ))}
          </NavigationList>
        </div>
      ))}
    </div>
  );
}
