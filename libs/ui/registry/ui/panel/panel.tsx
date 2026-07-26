"use client";

import {
  Children,
  type ComponentPropsWithRef,
  type ElementType,
  isValidElement,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import { PanelContext, type PanelContextValue } from "./panel-context";
import { PanelDescription } from "./panel-description";
import { PanelTitle } from "./panel-title";

export type PanelElement = "div" | "article" | "section" | "aside";

/** Allowed panel frame values. */
export type PanelFrame = "hairline" | "rail" | "viewfinder" | "surface";
/** Allowed panel tone values. */
export type PanelTone = "info" | "success" | "warning" | "error" | "accent";
/** Allowed panel density values. */
export type PanelDensity = "default" | "compact";

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
  /**
   * Marks the panel as the active pane: viewfinder corner brackets render in --ring, thicker and
   * longer than the resting frame, on every frame. Visual affordance only - it does not move focus
   * or change ARIA.
   */
  focused?: boolean;
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
 * Root container. Polymorphic via `as` (div, article, section, aside). A statically discoverable
 * Panel.Title or an explicit ARIA name switches the initial render to <section>. When an opaque
 * child component creates the title or description, give those parts stable ids and pass
 * aria-labelledby/aria-describedby to Panel so the server-rendered root is wired.
 */
export function Panel<T extends PanelElement = "div">(props: PanelProps<T>) {
  const {
    as,
    ref,
    className,
    frame,
    tone,
    density,
    focused,
    children,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    ...rest
  } = props as PanelProps<PanelElement>;

  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  // Registration (consumer id wins) covers titles wrapped in layout/consumer
  // components; the static child scan seeds SSR and the first client render.
  const [registeredTitleId, setRegisteredTitleId] = useState<string | null>(null);
  const [registeredDescriptionId, setRegisteredDescriptionId] = useState<string | null>(null);

  const unregisterTitle = useCallback(
    (nextId: string) => setRegisteredTitleId((current) => (current === nextId ? null : current)),
    [],
  );
  const unregisterDescription = useCallback(
    (nextId: string) =>
      setRegisteredDescriptionId((current) => (current === nextId ? null : current)),
    [],
  );

  const resolvedFrame = frame ?? "hairline";
  const resolvedDensity = density ?? "default";
  // The viewfinder frame owns resting corners; `focused` grows them on any frame.
  const hasCorners = resolvedFrame === "viewfinder" || focused === true;
  const isFocused = focused === true;

  const contextValue = useMemo<PanelContextValue>(
    () => ({
      hasCorners,
      focused: isFocused,
      titleId,
      descriptionId,
      registerTitle: setRegisteredTitleId,
      unregisterTitle,
      registerDescription: setRegisteredDescriptionId,
      unregisterDescription,
    }),
    [hasCorners, isFocused, titleId, descriptionId, unregisterTitle, unregisterDescription],
  );

  const resolvedTitleId = registeredTitleId ?? findPanelChildId(children, PanelTitle, titleId);
  const resolvedDescriptionId =
    registeredDescriptionId ?? findPanelChildId(children, PanelDescription, descriptionId);
  const hasRenderableTitle = resolvedTitleId !== null;
  const hasAriaName = isNonEmptyString(ariaLabel) || isNonEmptyString(ariaLabelledBy);
  const isNamedRegion = hasRenderableTitle || hasAriaName;

  const Tag = (as ?? (isNamedRegion ? "section" : "div")) as ElementType;

  const accessibleName = resolvePanelAccessibleName({
    ariaLabel,
    ariaLabelledBy,
    titleId: resolvedTitleId ?? titleId,
    hasRenderableTitle,
  });
  const resolvedAriaDescribedBy = mergeAriaIds(ariaDescribedBy, resolvedDescriptionId);

  return (
    <PanelContext value={contextValue}>
      <Tag
        {...rest}
        ref={ref}
        data-slot="panel"
        data-frame={resolvedFrame}
        data-tone={tone ?? undefined}
        data-density={resolvedDensity}
        data-state={focused ? "focused" : undefined}
        aria-label={accessibleName["aria-label"]}
        aria-labelledby={accessibleName["aria-labelledby"]}
        aria-describedby={resolvedAriaDescribedBy}
        className={className}
      >
        {hasCorners ? (
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

// Resolved id of the first PanelTitle/PanelDescription in the tree (consumer id
// wins), used to seed aria wiring before registration effects run.
function findPanelChildId(
  children: ReactNode,
  target: typeof PanelTitle | typeof PanelDescription,
  fallbackId: string,
): string | null {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ id?: unknown; children?: ReactNode }>(child)) continue;
    if (child.type === target) {
      return typeof child.props.id === "string" ? child.props.id : fallbackId;
    }
    // Nested <Panel> subtrees own their own PanelContext; their titles/descriptions
    // register only to that inner panel, so the outer root must not claim them.
    if (child.type === Panel) continue;
    const nested = findPanelChildId(child.props.children, target, fallbackId);
    if (nested !== null) return nested;
  }
  return null;
}

function mergeAriaIds(external: string | undefined, ownId: string | null): string | undefined {
  const externalId = isNonEmptyString(external) ? external : undefined;
  if (externalId && ownId) return `${externalId} ${ownId}`;
  return externalId ?? ownId ?? undefined;
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
