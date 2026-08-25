import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";

/** Keyboard-cursor glyph. Exclusively the keyboard's: hover never paints it. */
const INDICATOR_ACTIVE = "▌";

const iconSlotBase =
  "pr-4 shrink-0 inline-flex w-5 items-center justify-center self-center leading-none relative -top-[2px]";

/**
 * Fixed-width slot: "▌" for the keyboard cursor, a chevron on the hovered row,
 * empty when idle. The slot always renders at w-5, so revealing the chevron
 * never shifts the label column.
 */
function MenuItemIndicator({
  isFocused,
  isSelected,
  isHovered,
  className,
}: {
  isFocused: boolean;
  isSelected: boolean;
  isHovered: boolean;
  className?: string;
}) {
  const showCursor = isFocused || isSelected;
  return (
    <span aria-hidden="true" className={cn(iconSlotBase, className)}>
      {showCursor && INDICATOR_ACTIVE}
      {/* top-[2px] cancels the slot's text-baseline offset, which an SVG doesn't share. */}
      {!showCursor && isHovered && (
        <Chevron direction="right" size="sm" className="relative top-[2px]" />
      )}
    </span>
  );
}

function MenuItemIconSlot({
  icon,
  isFocused,
  isSelected,
  isHovered,
  iconIdleClassName,
  indicatorIdleClassName,
}: {
  icon?: ReactNode;
  isFocused: boolean;
  isSelected: boolean;
  isHovered: boolean;
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
      isHovered={isHovered}
      className={indicatorIdleClassName}
    />
  );
}

interface DefaultItemLayoutProps {
  isFocused: boolean;
  isSelected: boolean;
  isHovered: boolean;
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
  isHovered,
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
        isHovered={isHovered}
        iconIdleClassName={isEmphasized ? undefined : idleColor}
        indicatorIdleClassName={isEmphasized ? undefined : idleColor}
      />
      {/* Labels start in one column right after the icon; accelerators are
          pushed to the row end so rows with and without one still align. */}
      <span className="min-w-0 flex-1 tracking-wide">{children}</span>
      {hotkey !== undefined && (
        // Keep the unbound label out of the accessible name and typeahead text, and
        // off coarse pointers entirely — a keyboard accelerator says nothing to touch.
        <span
          aria-hidden="true"
          className={cn(
            "ml-4 shrink-0 tabular-nums pointer-coarse:hidden",
            !isEmphasized && idleColor,
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
  isHovered: boolean;
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
  isHovered,
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
          isHovered={isHovered}
          indicatorIdleClassName={isEmphasized ? undefined : "text-foreground"}
        />
        <span className={isEmphasized ? undefined : "font-medium"}>{children}</span>
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
