"use client";

import { useCallback } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";

/** Props for stepper state. */
export interface StepperStateProps {
  /** Controlled set of currently expanded step ids. */
  expandedIds?: string[];
  /** Initial expanded ids for uncontrolled mode. */
  defaultExpandedIds?: string[];
  /** Fired when the expanded set changes. */
  onExpandedChange?: (ids: string[]) => void;
}

/** Provides stepper state behavior. */
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

  const toggle = useCallback(
    (id: string) => {
      setExpanded((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
    },
    [setExpanded],
  );

  return { expandedIds: expanded, toggle };
}
