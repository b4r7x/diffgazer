import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const INDICATOR_ACTIVE = "▌";
const INDICATOR_IDLE = ">";

const iconSlotBase =
  "pr-4 shrink-0 inline-flex w-5 items-center justify-center self-center leading-none relative -top-[2px]";

function MenuItemIndicator({
  isFocused,
  isSelected,
  className,
}: {
  isFocused: boolean;
  isSelected: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn(iconSlotBase, className)}>
      {isFocused || isSelected ? INDICATOR_ACTIVE : INDICATOR_IDLE}
    </span>
  );
}

function MenuItemIconSlot({
  icon,
  isFocused,
  isSelected,
  iconIdleClassName,
  indicatorIdleClassName,
}: {
  icon?: ReactNode;
  isFocused: boolean;
  isSelected: boolean;
  iconIdleClassName?: string;
  indicatorIdleClassName?: string;
}) {
  if (icon !== undefined) {
    const isEmphasized = isFocused || isSelected;
    return (
      <span aria-hidden="true" className={cn(iconSlotBase, !isEmphasized && iconIdleClassName)}>
        {icon}
      </span>
    );
  }
  return (
    <MenuItemIndicator
      isFocused={isFocused}
      isSelected={isSelected}
      className={indicatorIdleClassName}
    />
  );
}

interface DefaultItemLayoutProps {
  isFocused: boolean;
  isSelected: boolean;
  isDanger: boolean;
  /** Decorative hotkey label rendered as [n]. */
  hotkey?: number | string;
  /** Icon content rendered by the component. */
  icon?: ReactNode;
  /** Item label. */
  children: ReactNode;
}

export function DefaultItemLayout({
  isFocused,
  isSelected,
  isDanger,
  hotkey,
  icon,
  children,
}: DefaultItemLayoutProps) {
  const idleColor = isDanger ? "text-error" : "text-foreground";
  const isEmphasized = isFocused || isSelected;

  return (
    <>
      <MenuItemIconSlot
        icon={icon}
        isFocused={isFocused}
        isSelected={isSelected}
        iconIdleClassName={isEmphasized ? undefined : idleColor}
        indicatorIdleClassName={
          isEmphasized
            ? undefined
            : cn("transition-opacity opacity-0 group-hover:opacity-100", idleColor)
        }
      />
      {/* Labels start in one column right after the icon; accelerators are
          pushed to the row end so rows with and without one still align. */}
      <span
        className={cn(
          "min-w-0 flex-1 tracking-wide",
          !isEmphasized && !isDanger && "group-hover:text-foreground",
        )}
      >
        {children}
      </span>
      {hotkey !== undefined && (
        // Keep the unbound label out of the accessible name and typeahead text, and
        // off coarse pointers entirely — a keyboard accelerator says nothing to touch.
        <span
          aria-hidden="true"
          className={cn(
            "ml-4 shrink-0 tabular-nums pointer-coarse:hidden",
            !isEmphasized && ["group-hover:text-foreground", idleColor],
          )}
        >
          [{hotkey}]
        </span>
      )}
    </>
  );
}

interface DetailItemLayoutProps {
  isFocused: boolean;
  isSelected: boolean;
  /** Right-aligned detail cell content. */
  value?: ReactNode;
  valueClassName: string;
  /**
   * Decorative glyph rendered before the value. Carries the success state in
   * monochrome palettes, where --success resolves to the foreground colour and
   * hue alone cannot say "passing".
   */
  valueGlyph?: string;
  /** Icon content rendered by the component. */
  icon?: ReactNode;
  /** Item label. */
  children: ReactNode;
}

export function DetailItemLayout({
  isFocused,
  isSelected,
  value,
  valueClassName,
  valueGlyph,
  icon,
  children,
}: DetailItemLayoutProps) {
  const isEmphasized = isFocused || isSelected;

  return (
    <>
      <div className="flex items-center">
        <MenuItemIconSlot
          icon={icon}
          isFocused={isFocused}
          isSelected={isSelected}
          indicatorIdleClassName={
            !isEmphasized
              ? "text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              : undefined
          }
        />
        <span className={isEmphasized ? undefined : "font-medium group-hover:text-foreground"}>
          {children}
        </span>
      </div>
      {value !== undefined && value !== null && (
        <div className={valueClassName}>
          {/* Not aria-hidden: the glyph is what carries "passing" when color cannot, so
              hiding it would leave the state visible only to sighted users. */}
          {valueGlyph !== undefined && <span className="mr-1">{valueGlyph}</span>}
          {value}
        </div>
      )}
    </>
  );
}
