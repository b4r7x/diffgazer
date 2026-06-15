"use client";

import { useState } from "react";
import { ToggleGroup } from "@/components/ui/toggle-group";

export default function ToggleGroupVertical() {
  const [value, setValue] = useState<string | null>("modified");

  return (
    <ToggleGroup
      label="File filter (vertical)"
      value={value}
      onChange={setValue}
      orientation="vertical"
    >
      <ToggleGroup.Item value="all">All</ToggleGroup.Item>
      <ToggleGroup.Item value="added">Added</ToggleGroup.Item>
      <ToggleGroup.Item value="modified">Modified</ToggleGroup.Item>
      <ToggleGroup.Item value="deleted">Deleted</ToggleGroup.Item>
    </ToggleGroup>
  );
}
