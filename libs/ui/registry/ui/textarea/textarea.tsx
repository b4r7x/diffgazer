"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { CSSProperties, Ref, TextareaHTMLAttributes } from "react";
import { useRef } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { inputVariants } from "@/lib/input-variants";
import { cn } from "@/lib/utils";
import { type TextareaResizeHandle, TextareaResizer } from "./textarea-resizer";
import { type TextareaResizeAxis, useTextareaResize } from "./use-textarea-resize";

const textareaVariants = cva(
  "h-auto min-w-0 resize-none overflow-x-auto overflow-y-auto scrollbar-thin [scrollbar-gutter:stable] aria-invalid:bg-[color-mix(in_oklab,var(--error)_4%,var(--background))] aria-invalid:placeholder:text-error/65",
  {
    variants: {
      size: {
        sm: "min-h-16",
        md: "min-h-20",
        lg: "min-h-24",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type TextareaResize = "none" | "vertical" | "horizontal" | "both";

/** A single handle for both edges, or one per edge. */
export type TextareaResizeHandles =
  | TextareaResizeHandle
  | { vertical?: TextareaResizeHandle; horizontal?: TextareaResizeHandle };

function resolveHandle(
  handles: TextareaResizeHandles | undefined,
  axis: TextareaResizeAxis,
): TextareaResizeHandle {
  if (handles === undefined) return "line";
  if (typeof handles === "string") return handles;
  return handles[axis] ?? "line";
}

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLTextAreaElement>;
  /** Axes exposed by the external resize handles. */
  resize?: TextareaResize;
  /** Visual form of each resize handle. */
  resizeHandle?: TextareaResizeHandles;
  /** Accessible names for the resize handles, per axis. Defaults to `Resize textarea <axis>`. */
  resizeLabels?: Partial<Record<TextareaResizeAxis, string>>;
}

/**
 * Terminal-styled multi-line text area with directional resize handles that sit
 * outside its scroll area.
 */
export function Textarea({
  className,
  size,
  ref,
  disabled,
  readOnly,
  resize = "vertical",
  resizeHandle,
  resizeLabels,
  style,
  ...props
}: TextareaProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composedRef = useComposedRefs(textareaRef, ref);
  const { activeAxis, size: appliedSize, getAxisProps } = useTextareaResize(textareaRef, rootRef);

  const canResize = !disabled && !readOnly && resize !== "none";
  const canResizeHorizontally = canResize && (resize === "horizontal" || resize === "both");
  const canResizeVertically = canResize && (resize === "vertical" || resize === "both");
  const isResizingHorizontally = activeAxis === "horizontal" && canResizeHorizontally;
  const isResizingVertically = activeAxis === "vertical" && canResizeVertically;
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";

  const rootStyle: CSSProperties | undefined =
    appliedSize.width === null ? undefined : { width: appliedSize.width };
  const textareaStyle: CSSProperties | undefined =
    appliedSize.height === null ? style : { ...style, height: appliedSize.height };

  return (
    <div
      data-slot="textarea-root"
      data-resize={canResize ? resize : undefined}
      className={cn(
        // Each resizable edge reserves a 16px band. The field's own border is
        // never broken and no chrome is ever painted over its content box.
        "group/textarea relative w-full min-w-0",
        canResizeVertically && "pb-4",
        canResizeHorizontally && "min-w-40 max-w-full pr-4",
        (isResizingVertically || isResizingHorizontally) && "select-none",
      )}
      ref={rootRef}
      style={rootStyle}
    >
      <textarea
        data-slot="textarea"
        className={cn(
          inputVariants({ size }),
          textareaVariants({ size }),
          disabled &&
            "disabled:bg-[color-mix(in_oklab,var(--foreground)_3%,var(--background))] disabled:text-muted-foreground disabled:opacity-100 disabled:placeholder:text-muted-foreground/50 read-only:bg-[color-mix(in_oklab,var(--foreground)_3%,var(--background))] read-only:text-muted-foreground read-only:shadow-none read-only:placeholder:text-muted-foreground/50",
          readOnly &&
            !disabled &&
            "read-only:bg-[color-mix(in_oklab,var(--foreground)_6%,var(--background))] read-only:shadow-[inset_3px_0_0_var(--border-strong)]",
          className,
        )}
        disabled={disabled}
        readOnly={readOnly}
        ref={composedRef}
        style={textareaStyle}
        {...props}
      />
      {canResizeVertically ? (
        <TextareaResizer
          axis="vertical"
          handle={resolveHandle(resizeHandle, "vertical")}
          active={isResizingVertically}
          invalid={isInvalid}
          label={resizeLabels?.vertical}
          {...getAxisProps("vertical")}
        />
      ) : null}
      {canResizeHorizontally ? (
        <TextareaResizer
          axis="horizontal"
          handle={resolveHandle(resizeHandle, "horizontal")}
          active={isResizingHorizontally}
          invalid={isInvalid}
          label={resizeLabels?.horizontal}
          {...getAxisProps("horizontal")}
        />
      ) : null}
    </div>
  );
}
