"use client";

import { useState } from "react";
import { ToggleGroup } from "@/components/ui/toggle-group";

export default function ToggleGroupVariants() {
  const [filter, setFilter] = useState<string | null>("modified");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Default</span>
        <ToggleGroup
          label="File filter (default variant)"
          value={filter}
          onChange={setFilter}
          variant="default"
        >
          <ToggleGroup.Item value="all">All</ToggleGroup.Item>
          <ToggleGroup.Item value="added">Added</ToggleGroup.Item>
          <ToggleGroup.Item value="modified">Modified</ToggleGroup.Item>
          <ToggleGroup.Item value="deleted">Deleted</ToggleGroup.Item>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Bracket</span>
        <ToggleGroup
          label="File filter (bracket variant)"
          value={filter}
          onChange={setFilter}
          variant="bracket"
        >
          <ToggleGroup.Item value="all">All</ToggleGroup.Item>
          <ToggleGroup.Item value="added">Added</ToggleGroup.Item>
          <ToggleGroup.Item value="modified">Modified</ToggleGroup.Item>
          <ToggleGroup.Item value="deleted">Deleted</ToggleGroup.Item>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Pill</span>
        <ToggleGroup
          label="File filter (pill variant)"
          value={filter}
          onChange={setFilter}
          variant="pill"
        >
          <ToggleGroup.Item value="all">All</ToggleGroup.Item>
          <ToggleGroup.Item value="added">Added</ToggleGroup.Item>
          <ToggleGroup.Item value="modified">Modified</ToggleGroup.Item>
          <ToggleGroup.Item value="deleted">Deleted</ToggleGroup.Item>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Underline
        </span>
        <ToggleGroup
          label="File filter (underline variant)"
          value={filter}
          onChange={setFilter}
          variant="underline"
        >
          <ToggleGroup.Item value="all">All</ToggleGroup.Item>
          <ToggleGroup.Item value="added">Added</ToggleGroup.Item>
          <ToggleGroup.Item value="modified">Modified</ToggleGroup.Item>
          <ToggleGroup.Item value="deleted">Deleted</ToggleGroup.Item>
        </ToggleGroup>
      </div>
    </div>
  );
}
