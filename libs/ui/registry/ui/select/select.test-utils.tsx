import { type RenderResult, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Select, type SelectProps } from "./index";

export const PICK_FRUIT = "Pick a fruit";

export function getSelectTrigger() {
  const trigger = document.querySelector<HTMLElement>('[data-slot="select-trigger"]');
  if (!trigger) throw new Error("Expected a SelectTrigger to be rendered");
  return trigger;
}

export function getSearchInput() {
  return screen.getByRole("combobox", { name: /search options/i });
}

export function getTestForm(label: string | RegExp = "Test form") {
  return screen.getByRole("form", { name: label }) as HTMLFormElement;
}

function buildSelectProps({
  multiple,
  variant,
  defaultValue,
  value,
  onChange,
  open,
  onOpenChange,
  defaultOpen,
  disabled,
  highlighted,
  onHighlightChange,
}: {
  multiple?: boolean;
  variant?: "default" | "card";
  defaultValue?: string | string[];
  value?: string | string[];
  onChange?: (v: string | string[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  disabled?: boolean;
  highlighted?: string | null;
  onHighlightChange?: (id: string | null) => void;
}): SelectProps {
  const commonProps = {
    variant,
    children: null,
    ...(open !== undefined ? { open } : {}),
    ...(onOpenChange ? { onOpenChange } : {}),
    ...(defaultOpen !== undefined ? { defaultOpen } : {}),
    ...(disabled ? { disabled: true } : {}),
    ...(highlighted !== undefined ? { highlighted } : {}),
    ...(onHighlightChange ? { onHighlightChange } : {}),
  };
  return multiple
    ? {
        ...commonProps,
        multiple: true,
        ...(Array.isArray(defaultValue) ? { defaultValue } : {}),
        ...(Array.isArray(value) ? { value } : {}),
        ...(onChange ? { onChange: onChange as (v: string[]) => void } : {}),
      }
    : {
        ...commonProps,
        multiple: false,
        ...(typeof defaultValue === "string" ? { defaultValue } : {}),
        ...(typeof value === "string" ? { value } : {}),
        ...(onChange ? { onChange: onChange as (v: string) => void } : {}),
      };
}

export function renderSelect({
  multiple,
  defaultValue,
  value,
  onChange,
  open,
  onOpenChange,
  defaultOpen,
  disabled,
  highlighted,
  items = ["Apple", "Banana", "Cherry"],
  withSearch = false,
  variant = "card",
  tagsClassName,
}: {
  multiple?: boolean;
  defaultValue?: string | string[];
  value?: string | string[];
  onChange?: (v: string | string[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  disabled?: boolean;
  highlighted?: string | null;
  items?: string[];
  withSearch?: boolean;
  variant?: "default" | "card";
  tagsClassName?: string;
} = {}): RenderResult {
  const props = buildSelectProps({
    multiple,
    variant,
    defaultValue,
    value,
    onChange,
    open,
    onOpenChange,
    defaultOpen,
    disabled,
    highlighted,
  });

  return render(
    <Select {...props}>
      <Select.Trigger aria-label="Fruit">
        {multiple ? (
          <Select.Tags placeholder="Pick fruits" className={tagsClassName} />
        ) : (
          <Select.Value placeholder={PICK_FRUIT} />
        )}
      </Select.Trigger>
      <Select.Content>
        {withSearch && <Select.Search />}
        {items.map((item) => (
          <Select.Item key={item} value={item.toLowerCase()}>
            {item}
          </Select.Item>
        ))}
        {withSearch && <Select.Empty />}
      </Select.Content>
    </Select>,
  );
}

export interface InlineRenderProps {
  readonly children: ReactNode;
  readonly multiple?: boolean;
  readonly variant?: "default" | "card";
  readonly defaultValue?: string | string[];
  readonly onChange?: (v: string | string[]) => void;
  readonly defaultOpen?: boolean;
  readonly highlighted?: string | null;
  readonly onHighlightChange?: (id: string | null) => void;
}

export function renderSelectInline({
  children,
  multiple,
  variant = "card",
  defaultValue,
  onChange,
  defaultOpen,
  highlighted,
  onHighlightChange,
}: InlineRenderProps): RenderResult {
  const props = buildSelectProps({
    multiple,
    variant,
    defaultValue,
    onChange,
    defaultOpen,
    highlighted,
    onHighlightChange,
  });

  return render(
    <Select {...props}>
      <Select.Trigger aria-label="Fruit">
        {multiple ? (
          <Select.Tags placeholder="Pick fruits" />
        ) : (
          <Select.Value placeholder={PICK_FRUIT} />
        )}
      </Select.Trigger>
      <Select.Content>{children}</Select.Content>
    </Select>,
  );
}
