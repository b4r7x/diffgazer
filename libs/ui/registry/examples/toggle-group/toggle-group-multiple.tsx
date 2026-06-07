"use client";

import { useState } from "react";
import { ToggleGroup } from "@/components/ui/toggle-group";

export default function ToggleGroupMultiple() {
  const [severity, setSeverity] = useState<readonly string[]>(["high", "critical"]);

  return (
    <ToggleGroup selectionMode="multiple" value={severity} onChange={setSeverity}>
      <ToggleGroup.Item value="low">Low</ToggleGroup.Item>
      <ToggleGroup.Item value="medium">Medium</ToggleGroup.Item>
      <ToggleGroup.Item value="high">High</ToggleGroup.Item>
      <ToggleGroup.Item value="critical">Critical</ToggleGroup.Item>
    </ToggleGroup>
  );
}
