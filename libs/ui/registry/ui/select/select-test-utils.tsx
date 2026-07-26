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

export interface SelectHarnessOptions {
  readonly multiple?: boolean;
  readonly variant?: "default" | "card";
  readonly defaultValue?: string | string[];
  readonly value?: string | string[];
  readonly onChange?: (v: string | string[]) => void;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly defaultOpen?: boolean;
  readonly disabled?: boolean;
  readonly highlighted?: string | null;
  readonly onHighlightChange?: (id: string | null) => void;
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
}: SelectHarnessOptions): SelectProps {
  // Select derives controlled mode from `"open" in props` / `"highlighted" in props`,
  // so those two must stay absent rather than undefined.
  const commonProps = {
    variant,
    children: null,
    onOpenChange,
    defaultOpen,
    disabled,
    onHighlightChange,
    ...(open !== undefined ? { open } : {}),
    ...(highlighted !== undefined ? { highlighted } : {}),
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
}: SelectHarnessOptions & {
  readonly items?: string[];
  readonly withSearch?: boolean;
  readonly tagsClassName?: string;
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

export interface InlineRenderProps extends SelectHarnessOptions {
  readonly children: ReactNode;
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
