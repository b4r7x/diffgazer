"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { useFocusRestore } from "@/hooks/use-focus-restore";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { cn } from "@/lib/utils";
import { DialogShell } from "../shared/dialog-shell";
import { PortalContainerProvider } from "../shared/portal-context";
import { useCommandPaletteContext } from "./command-palette-context";

/** Allowed command palette frame values. */
export type CommandPaletteFrame = "border" | "viewfinder" | "terminal" | "card" | "none";
/** Allowed command palette density values. */
export type CommandPaletteDensity = "compact" | "comfortable" | "dense";

/** Class variants for command palette content. */
export const commandPaletteContentVariants = cva(
  cn(
    "relative flex flex-col max-h-[80dvh] w-full font-mono",
    // Top-pinned, not centred: the software keyboard shrinks the visual viewport
    // the instant the user starts typing, and a centred panel jumps upward at
    // exactly the wrong moment. A fixed top edge holds the input row still for
    // the whole session. max() degrades to 12px without viewport-fit=cover.
    "mx-auto mt-[max(0.75rem,env(safe-area-inset-top))] mb-auto",
    // Narrow viewports: inset from the edge so both vertical hairlines and the
    // offset shadow stay on-screen. At >=640px the size variants still rule.
    "max-sm:mx-3 max-sm:w-[calc(100%-1.5rem)] max-sm:max-w-none",
  ),
  {
    variants: {
      size: { sm: "max-w-sm", md: "max-w-xl", lg: "max-w-2xl" },
    },
    defaultVariants: { size: "md" },
  },
);

function getLiveText(search: string, itemCount: number): string {
  if (!search) return "";
  if (itemCount === 0) return "No results";
  return `${itemCount} result${itemCount === 1 ? "" : "s"} available`;
}

/** Props for command palette content. */
export interface CommandPaletteContentProps
  extends VariantProps<typeof commandPaletteContentVariants> {
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Accessible name for the modal dialog. */
  label?: string;
  /**
   * Shell chrome style. "border" renders a 1px hairline. "viewfinder" renders four corner
   * brackets with no border plus a 2px left accent bar on the selected row. "terminal" renders
   * top + bottom 2px rules with inverted selection and swaps the default prefix glyph from > to
   * $. "card" renders an 8px rounded shell with a subtle gradient surface and a floating
   * rounded selection (compose with a search-icon `prefix` for the Linear look). "none" is a
   * bare shell for embedding.
   */
  frame?: CommandPaletteFrame | null;
  /**
   * Typographic and spacing surface. Switches a token block (--command-palette-row-h,
   * --command-palette-input-py, --command-palette-list-p, --command-palette-text-size, etc.)
   * consumed by every inner slot via [data-density] selectors in
   * command-palette/command-palette.css. "compact" matches the V1 refined-mono target,
   * "comfortable" is Linear-ish breathing room, "dense" is VSCode-tight.
   */
  density?: CommandPaletteDensity | null;
  /**
   * Renders the palette as a modal dialog in the browser top layer (default). Pass false to
   * render it in the document flow instead — an embedded palette with the same frame, density,
   * and highlight chrome, without a backdrop, focus trap, or focus restoration. Inline palettes
   * still honour `open`, so they unmount when the consumer closes them.
   */
  modal?: boolean;
}

/** Modal (or embedded) palette container with frame + density variants. */
export function CommandPaletteContent({
  children,
  className,
  size,
  frame,
  density,
  modal = true,
  label = "Command palette",
}: CommandPaletteContentProps) {
  const { open, onOpenChange, search, onSearchChange, itemCount, inputRef } =
    useCommandPaletteContext();
  const shellRef = useRef<HTMLDialogElement>(null);
  const scrollLockTargetRef = useRef<HTMLElement>(null);
  const [container, setContainer] = useState<Element | null>(null);
  const focusRestore = useFocusRestore({ restoreOnUnmount: true });
  useScrollLock({ target: scrollLockTargetRef, enabled: open && modal });

  const resolvedFrame = frame ?? "border";
  const resolvedDensity = density ?? "compact";

  // Stable identity for DialogShell's dialogRef callback so the underlying ref isn't re-attached on every render.
  const setDialogRef = useCallback((node: HTMLDialogElement | null) => {
    shellRef.current = node;
    scrollLockTargetRef.current = node?.ownerDocument.body ?? null;
    setContainer(node);
  }, []);

  // Stable identity for DialogShell's onAfterShowModal so focus runs only on open transitions.
  const focusSearchInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  const handleClose = useCallback(() => {
    const view = shellRef.current?.ownerDocument.defaultView ?? globalThis;
    view.requestAnimationFrame(() => {
      focusRestore.restore();
    });
  }, [focusRestore]);

  const inner = (
    <PortalContainerProvider container={container}>
      {resolvedFrame === "viewfinder" ? <span aria-hidden="true" className="cp-corners" /> : null}
      {children}
      {/* biome-ignore lint/a11y/useSemanticElements: role="status" is the sr-only results-count live region; <output> carries form-association semantics that do not fit here. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {getLiveText(search, itemCount)}
      </div>
    </PortalContainerProvider>
  );

  if (!modal) {
    if (!open) return null;
    return (
      // biome-ignore lint/a11y/useSemanticElements: <fieldset> is a form-control grouping element; this is a labelled composite region wrapping a combobox and its listbox, so role="group" on a div is the correct mapping.
      <div
        // Inline mode has no dialog element; the shell itself is the portal container.
        ref={setContainer}
        role="group"
        aria-label={label}
        data-slot="command-palette-content"
        data-frame={resolvedFrame}
        data-density={resolvedDensity}
        data-state="open"
        className={cn(commandPaletteContentVariants({ size }), className)}
      >
        {inner}
      </div>
    );
  }

  return (
    <DialogShell
      open={open}
      dialogRef={setDialogRef}
      onBeforeShowModal={focusRestore.capture}
      onAfterShowModal={focusSearchInput}
      onBackdropClick={() => onOpenChange(false)}
      onCancel={() => (search ? onSearchChange("") : onOpenChange(false))}
      onExitComplete={handleClose}
      className={cn(commandPaletteContentVariants({ size }), className)}
      data-slot="command-palette-content"
      data-frame={resolvedFrame}
      data-density={resolvedDensity}
      aria-modal="true"
      aria-label={label}
    >
      {inner}
    </DialogShell>
  );
}
