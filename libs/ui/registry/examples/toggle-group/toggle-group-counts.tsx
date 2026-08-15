"use client";

import { useState } from "react";
import { createToggleGroup } from "@/components/ui/toggle-group";

const SmallSeverityGroup = createToggleGroup(["error", "warning", "info"] as const);
const MediumSeverityGroup = createToggleGroup(["error", "warning"] as const);

type SmallSeverity = (typeof SmallSeverityGroup.values)[number];
type MediumSeverity = (typeof MediumSeverityGroup.values)[number];

export default function ToggleGroupCounts() {
  const [smallFilter, setSmallFilter] = useState<SmallSeverity | null>("error");
  const [mediumFilter, setMediumFilter] = useState<MediumSeverity | null>("error");

  return (
    <div className="flex flex-col gap-4">
      <SmallSeverityGroup
        label="Severity filter (small)"
        value={smallFilter}
        onChange={setSmallFilter}
        allowDeselect
        size="sm"
      >
        <SmallSeverityGroup.Item value="error" count={3}>
          Error
        </SmallSeverityGroup.Item>
        <SmallSeverityGroup.Item value="warning" count={12}>
          Warning
        </SmallSeverityGroup.Item>
        <SmallSeverityGroup.Item value="info" count={27}>
          Info
        </SmallSeverityGroup.Item>
      </SmallSeverityGroup>
      <MediumSeverityGroup
        label="Severity filter (medium)"
        value={mediumFilter}
        onChange={setMediumFilter}
        allowDeselect
        size="md"
      >
        <MediumSeverityGroup.Item value="error" count={3}>
          Error
        </MediumSeverityGroup.Item>
        <MediumSeverityGroup.Item value="warning" count={12}>
          Warning
        </MediumSeverityGroup.Item>
      </MediumSeverityGroup>
    </div>
  );
}
