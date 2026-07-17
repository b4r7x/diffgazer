"use client";

import { useState } from "react";
import { ToggleGroup } from "@/components/ui/toggle-group";

type SmallSeverity = "error" | "warning" | "info";
type MediumSeverity = "error" | "warning";

export default function ToggleGroupCounts() {
  const [smallFilter, setSmallFilter] = useState<SmallSeverity | null>("error");
  const [mediumFilter, setMediumFilter] = useState<MediumSeverity | null>("error");

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        label="Severity filter (small)"
        value={smallFilter}
        onChange={setSmallFilter}
        allowDeselect
        size="sm"
      >
        <ToggleGroup.Item value="error" count={3}>
          Error
        </ToggleGroup.Item>
        <ToggleGroup.Item value="warning" count={12}>
          Warning
        </ToggleGroup.Item>
        <ToggleGroup.Item value="info" count={27}>
          Info
        </ToggleGroup.Item>
      </ToggleGroup>
      <ToggleGroup
        label="Severity filter (medium)"
        value={mediumFilter}
        onChange={setMediumFilter}
        allowDeselect
        size="md"
      >
        <ToggleGroup.Item value="error" count={3}>
          Error
        </ToggleGroup.Item>
        <ToggleGroup.Item value="warning" count={12}>
          Warning
        </ToggleGroup.Item>
      </ToggleGroup>
    </div>
  );
}
