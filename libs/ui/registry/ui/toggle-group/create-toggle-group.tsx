"use client";

import type { ReactElement, Ref } from "react";
import {
  ToggleGroup as ToggleGroupRoot,
  type ToggleGroupProps as ToggleGroupRootProps,
} from "./toggle-group";
import { ToggleGroupItem, type ToggleGroupItemProps } from "./toggle-group-item";

type ToggleGroupSingleBoundProps<TValue extends string> = Omit<
  Extract<ToggleGroupRootProps, { selectionMode?: "single" | undefined }>,
  "value" | "defaultValue" | "onChange" | "highlighted" | "onHighlightChange"
> & {
  value?: TValue | null;
  defaultValue?: TValue | null;
  onChange?: (value: TValue | null) => void;
  highlighted?: TValue | null;
  onHighlightChange?: (value: TValue | null) => void;
  ref?: Ref<HTMLDivElement>;
};

type ToggleGroupMultipleBoundProps<TValue extends string> = Omit<
  Extract<ToggleGroupRootProps, { selectionMode: "multiple" }>,
  "value" | "defaultValue" | "onChange" | "highlighted" | "onHighlightChange"
> & {
  value?: readonly TValue[];
  defaultValue?: readonly TValue[];
  onChange?: (value: readonly TValue[]) => void;
  highlighted?: TValue | null;
  onHighlightChange?: (value: TValue | null) => void;
  ref?: Ref<HTMLDivElement>;
};

type ToggleGroupBoundProps<TValue extends string> =
  | ToggleGroupSingleBoundProps<TValue>
  | ToggleGroupMultipleBoundProps<TValue>;

type ToggleGroupItemBoundProps<TValue extends string> = Omit<ToggleGroupItemProps, "value"> & {
  value: TValue;
};

export type CreateToggleGroupReturn<T extends readonly string[]> = {
  readonly values: T;
  (props: ToggleGroupBoundProps<T[number]>): ReactElement;
  Item: (props: ToggleGroupItemBoundProps<T[number]>) => ReactElement;
};

/**
 * Binds ToggleGroup and ToggleGroup.Item to one authoritative value collection so
 * item values and consumer callbacks share the same literal union.
 */
export function createToggleGroup<const T extends readonly string[]>(
  values: T,
): CreateToggleGroupReturn<T> {
  type TValue = T[number];

  function BoundToggleGroup(props: ToggleGroupBoundProps<TValue>) {
    if (props.selectionMode === "multiple") {
      const { onChange, onHighlightChange, ...rest } = props;
      return (
        <ToggleGroupRoot
          {...rest}
          selectionMode="multiple"
          onChange={onChange ? (value) => onChange(value as readonly TValue[]) : undefined}
          onHighlightChange={
            onHighlightChange ? (value) => onHighlightChange(value as TValue | null) : undefined
          }
        />
      );
    }

    const { onChange, onHighlightChange, ...rest } = props;
    return (
      <ToggleGroupRoot
        {...rest}
        onChange={onChange ? (value) => onChange(value as TValue | null) : undefined}
        onHighlightChange={
          onHighlightChange ? (value) => onHighlightChange(value as TValue | null) : undefined
        }
      />
    );
  }

  return Object.assign(BoundToggleGroup, {
    Item: ToggleGroupItem,
    values,
  });
}
