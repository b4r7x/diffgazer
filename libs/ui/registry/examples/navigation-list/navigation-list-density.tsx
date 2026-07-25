"use client";

import { NavigationList } from "@/components/ui/navigation-list";

const densities = [
  { value: "compact", padding: "6px" },
  { value: "default", padding: "12px" },
  { value: "comfortable", padding: "20px" },
] as const;

export default function NavigationListDensity() {
  return (
    <div className="flex flex-col gap-6">
      {densities.map(({ value: density, padding }) => (
        <div key={density}>
          <div className="text-xs text-muted-foreground uppercase font-bold mb-2">
            {density} · {padding}
          </div>
          <NavigationList defaultSelectedId="item-0" aria-label={`${density} list`}>
            <NavigationList.Item id="item-0" density={density}>
              <NavigationList.Title>{density} density item 1</NavigationList.Title>
              <NavigationList.Meta>
                <NavigationList.Subtitle>{density} spacing profile</NavigationList.Subtitle>
              </NavigationList.Meta>
            </NavigationList.Item>
            <NavigationList.Item id="item-1" density={density}>
              <NavigationList.Title>{density} density item 2</NavigationList.Title>
              <NavigationList.Meta>
                <NavigationList.Subtitle>{density} spacing profile</NavigationList.Subtitle>
              </NavigationList.Meta>
            </NavigationList.Item>
          </NavigationList>
        </div>
      ))}
    </div>
  );
}
