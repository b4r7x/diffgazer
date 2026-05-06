"use client";

import { useCallback } from "react";
import {
  useControllableState,
  type UseControllableStateOptions,
} from "@/hooks/use-controllable-state";
import type { AccordionProps } from "./accordion";

function normalizeStateOptions(
  props: AccordionProps,
): UseControllableStateOptions<string[]> {
  if (props.type === "multiple") {
    return {
      value: props.value,
      controlled: "value" in props,
      defaultValue: props.defaultValue ?? [],
      onChange: props.onChange,
    };
  }
  const { onChange } = props;
  return {
    value: "value" in props ? (props.value === undefined ? [] : [props.value]) : undefined,
    controlled: "value" in props,
    defaultValue: props.defaultValue !== undefined ? [props.defaultValue] : [],
    onChange: onChange ? (v: string[]) => onChange(v[0]) : undefined,
  };
}

function toggleSingle(
  prev: string[],
  value: string,
  collapsible: boolean,
): string[] {
  return prev.includes(value) ? (collapsible ? [] : prev) : [value];
}

function toggleMultiple(prev: string[], value: string): string[] {
  return prev.includes(value)
    ? prev.filter((v) => v !== value)
    : [...prev, value];
}

export function useAccordionState(props: AccordionProps) {
  const isSingle = props.type !== "multiple";
  const collapsible = props.type !== "multiple"
    ? (props.collapsible ?? true)
    : true;

  const [openValues, setOpenValues] = useControllableState(
    normalizeStateOptions(props),
  );

  const onToggle = useCallback((itemValue: string) => {
    setOpenValues((prev) =>
      isSingle
        ? toggleSingle(prev, itemValue, collapsible)
        : toggleMultiple(prev, itemValue),
    );
  }, [collapsible, isSingle, setOpenValues]);

  return { openValues, onToggle, collapsible };
}
