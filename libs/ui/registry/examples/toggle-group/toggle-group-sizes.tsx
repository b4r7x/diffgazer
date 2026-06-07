"use client";

import { useState } from "react";
import { ToggleGroup } from "@/components/ui/toggle-group";

export default function ToggleGroupSizes() {
  const [value, setValue] = useState<string | null>("added");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Small (sm)
        </span>
        <ToggleGroup value={value} onChange={setValue} size="sm">
          <ToggleGroup.Item value="all">All</ToggleGroup.Item>
          <ToggleGroup.Item value="added">Added</ToggleGroup.Item>
          <ToggleGroup.Item value="modified">Modified</ToggleGroup.Item>
          <ToggleGroup.Item value="deleted">Deleted</ToggleGroup.Item>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Medium (md)
        </span>
        <ToggleGroup value={value} onChange={setValue} size="md">
          <ToggleGroup.Item value="all">All</ToggleGroup.Item>
          <ToggleGroup.Item value="added">Added</ToggleGroup.Item>
          <ToggleGroup.Item value="modified">Modified</ToggleGroup.Item>
          <ToggleGroup.Item value="deleted">Deleted</ToggleGroup.Item>
        </ToggleGroup>
      </div>
    </div>
  );
}
