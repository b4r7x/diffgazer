"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
} from "react";
import {
  type UseControllableStateOptions,
  useControllableState,
} from "@/hooks/use-controllable-state";

/** Props for accordion in single-selection mode. */
export interface AccordionSingleProps {
  /**
   * Single allows one open item; multiple allows several open at once. Switches the
   * value/onChange/defaultValue shape from string to string[].
   */
  type?: "single";
  /** Controlled open value. `undefined` means no item is open. */
  value?: string | undefined;
  /**
   * Fired when the open value changes. `undefined` means no item is open.
   */
  onChange?: (value: string | undefined) => void;
  /** Initial open value(s) for uncontrolled mode. */
  defaultValue?: string;
  /** Single mode only. When false, the currently open item cannot be closed by clicking it. */
  collapsible?: boolean;
  /** AccordionItem children. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Accessible name when no visible label is supplied. */
  "aria-label"?: string;
  /** ID of the element that labels this component. */
  "aria-labelledby"?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
  /** Called when key down occurs. */
  onKeyDown?: (event: ReactKeyboardEvent) => void;
}

/** Props for accordion in multiple-selection mode. */
export interface AccordionMultipleProps {
  /**
   * Single allows one open item; multiple allows several open at once. Switches the
   * value/onChange/defaultValue shape from string to string[].
   */
  type: "multiple";
  /** Controlled open values. `undefined` is normalized to an empty array. */
  value?: string[] | undefined;
  /** Fired when the open values change. */
  onChange?: (value: string[]) => void;
  /** Initial open value(s) for uncontrolled mode. */
  defaultValue?: string[];
  /** AccordionItem children. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Accessible name when no visible label is supplied. */
  "aria-label"?: string;
  /** ID of the element that labels this component. */
  "aria-labelledby"?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
  /** Called when key down occurs. */
  onKeyDown?: (event: ReactKeyboardEvent) => void;
}

/** Props for accordion. */
export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

function normalizeStateOptions(props: AccordionProps): UseControllableStateOptions<string[]> {
  if (props.type === "multiple") {
    const controlled = "value" in props;
    return {
      value: controlled ? (props.value ?? []) : undefined,
      controlled,
      defaultValue: props.defaultValue ?? [],
      onChange: props.onChange,
    };
  }
  const controlled = "value" in props;
  let value: string[] | undefined;
  if (controlled) {
    value = props.value === undefined ? [] : [props.value];
  }

  return {
    value,
    controlled,
    defaultValue: props.defaultValue !== undefined ? [props.defaultValue] : [],
    onChange: props.onChange ? (v: string[]) => props.onChange?.(v[0]) : undefined,
  };
}

function toggleSingle(prev: string[], value: string, collapsible: boolean): string[] {
  if (!prev.includes(value)) return [value];
  return collapsible ? [] : prev;
}

function toggleMultiple(prev: string[], value: string): string[] {
  return prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
}

/** Provides accordion state behavior. */
export function useAccordionState(props: AccordionProps) {
  const isSingle = props.type !== "multiple";
  const collapsible = props.type !== "multiple" ? (props.collapsible ?? true) : true;

  const [openValues, setOpenValues] = useControllableState(normalizeStateOptions(props));

  const onToggle = useCallback(
    (itemValue: string) => {
      setOpenValues((prev) =>
        isSingle ? toggleSingle(prev, itemValue, collapsible) : toggleMultiple(prev, itemValue),
      );
    },
    [collapsible, isSingle, setOpenValues],
  );

  return { openValues, onToggle, collapsible };
}
