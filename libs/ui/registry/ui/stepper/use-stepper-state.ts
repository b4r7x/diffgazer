"use client";

import { useCallback } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";

export interface StepperStateProps {
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
}

export function useStepperState({
  expandedIds,
  defaultExpandedIds,
  onExpandedChange,
}: StepperStateProps) {
  const [expanded, setExpanded] = useControllableState<string[]>({
    value: expandedIds,
    defaultValue: defaultExpandedIds ?? [],
    onChange: onExpandedChange,
  });

  const toggle = useCallback((id: string) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }, [setExpanded]);

  return { expandedIds: expanded, toggle };
}
