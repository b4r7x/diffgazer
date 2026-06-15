"use client";

import {
  type ComponentPropsWithRef,
  type ElementType,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { PanelContext, type PanelContextValue } from "./panel-context";

/**
 * Root container. Polymorphic via `as` (div, article, section, aside). Switches to <section>
 * automatically when Panel.Title or aria-label is present.
 */
export type PanelElement = "div" | "article" | "section" | "aside";

/** Allowed panel frame values. */
export type PanelFrame = "hairline" | "rail" | "viewfinder" | "surface";
/** Allowed panel tone values. */
export type PanelTone = "info" | "success" | "warning" | "error" | "accent";
/** Allowed panel density values. */
export type PanelDensity = "default" | "compact";

/** Props for panel own. */
interface PanelOwnProps {
  /**
   * Visual chrome. Hairline = soft border + marker bar; rail = inline-start rail only;
   * viewfinder = corner brackets; surface = elevated --surface-1 background.
   */
  frame?: PanelFrame;
  /**
   * Border-color tint. Visual cue only - no semantic role, no live announcement. Use Callout
   * for real status messaging.
   */
  tone?: PanelTone;
  /** Padding rhythm. Default = 14/20; compact = 10/14. */
  density?: PanelDensity;
}

/** Props for panel. */
export type PanelProps<T extends PanelElement = "div"> = Omit<
  ComponentPropsWithRef<T>,
  keyof PanelOwnProps | "as"
> &
  PanelOwnProps & {
    as?: T;
  };

/**
 * Root container. Polymorphic via `as` (div, article, section, aside). Switches to <section>
 * automatically when Panel.Title or aria-label is present.
 */
export function Panel<T extends PanelElement = "div">(props: PanelProps<T>) {
  const {
    as,
    ref,
    className,
    frame,
    tone,
    density,
    children,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rest
  } = props as PanelProps<PanelElement>;

  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  // PanelTitle/PanelDescription register their RESOLVED id (consumer id wins)
  // on mount, so a title wrapped in a layout div or consumer component still
  // wires the panel's name. Registration replaces a brittle children-tree walk.
  const [registeredTitleId, setRegisteredTitleId] = useState<string | null>(null);
  const [registeredDescriptionId, setRegisteredDescriptionId] = useState<string | null>(null);

  const registerTitle = useCallback((nextId: string) => setRegisteredTitleId(nextId), []);
  const unregisterTitle = useCallback(
    (nextId: string) => setRegisteredTitleId((current) => (current === nextId ? null : current)),
    [],
  );
  const registerDescription = useCallback(
    (nextId: string) => setRegisteredDescriptionId(nextId),
    [],
  );
  const unregisterDescription = useCallback(
    (nextId: string) =>
      setRegisteredDescriptionId((current) => (current === nextId ? null : current)),
    [],
  );

  const contextValue = useMemo<PanelContextValue>(
    () => ({
      titleId,
      descriptionId,
      registerTitle,
      unregisterTitle,
      registerDescription,
      unregisterDescription,
    }),
    [
      titleId,
      descriptionId,
      registerTitle,
      unregisterTitle,
      registerDescription,
      unregisterDescription,
    ],
  );

  const hasRenderableTitle = registeredTitleId !== null;
  const hasRenderableDescription = registeredDescriptionId !== null;
  const hasAriaName = isNonEmptyString(ariaLabel) || isNonEmptyString(ariaLabelledBy);
  const isNamedRegion = hasRenderableTitle || hasAriaName;

  const resolvedFrame = frame ?? "hairline";
  const resolvedDensity = density ?? "default";
  const Tag = (as ?? (isNamedRegion ? "section" : "div")) as ElementType;

  const accessibleName = resolvePanelAccessibleName({
    ariaLabel,
    ariaLabelledBy,
    titleId: registeredTitleId ?? titleId,
    hasRenderableTitle,
  });
  const resolvedAriaDescribedBy = hasRenderableDescription
    ? (registeredDescriptionId ?? descriptionId)
    : undefined;

  return (
    <PanelContext value={contextValue}>
      <Tag
        {...rest}
        ref={ref}
        data-slot="panel"
        data-frame={resolvedFrame}
        data-tone={tone ?? undefined}
        data-density={resolvedDensity}
        aria-label={accessibleName["aria-label"]}
        aria-labelledby={accessibleName["aria-labelledby"]}
        aria-describedby={resolvedAriaDescribedBy}
        className={cn(className)}
      >
        {resolvedFrame === "viewfinder" ? (
          <span aria-hidden="true" data-slot="panel-corners">
            <span className="vf-tl" />
            <span className="vf-tr" />
            <span className="vf-bl" />
            <span className="vf-br" />
          </span>
        ) : null}
        {children}
      </Tag>
    </PanelContext>
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolvePanelAccessibleName({
  ariaLabel,
  ariaLabelledBy,
  titleId,
  hasRenderableTitle,
}: {
  ariaLabel: string | undefined;
  ariaLabelledBy: string | undefined;
  titleId: string;
  hasRenderableTitle: boolean;
}): { "aria-label": string | undefined; "aria-labelledby": string | undefined } {
  if (isNonEmptyString(ariaLabelledBy)) {
    return { "aria-label": undefined, "aria-labelledby": ariaLabelledBy };
  }
  if (isNonEmptyString(ariaLabel)) {
    return { "aria-label": ariaLabel, "aria-labelledby": undefined };
  }
  if (hasRenderableTitle) {
    return { "aria-label": undefined, "aria-labelledby": titleId };
  }
  return { "aria-label": undefined, "aria-labelledby": undefined };
}
